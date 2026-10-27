import Database from "better-sqlite3";
import { existsSync, closeSync, openSync, lstatSync } from "node:fs";
import type { ReviewedPlan } from "@schema-baron/model";
const url = new URL("./state.js", import.meta.url);
const { fingerprints, marker, markerDDL, markerTable, validateDatabase } =
  (await import(
    existsSync(url) ? url.href : new URL("./state.ts", import.meta.url).href
  )) as typeof import("./state.js");
interface Input {
  path: string;
  backupPath: string;
  id: string;
  authority: string;
  plan: Exclude<ReviewedPlan, { kind: "generation" }>;
  restorePath?: string;
  fault?: string;
}
const input = JSON.parse(process.env.SCHEMA_BARON_MIGRATION_WORKER!) as Input;
let db: Database.Database | undefined;
const fault = (point: string) => {
  if (input.fault === point) process.exit(86);
};
const fail = (code: string, message: string): never => {
  throw Object.assign(new Error(message), { code });
};
process.on("disconnect", () => {
  if (db?.open) db.close();
  process.exit(0);
});
try {
  const fileIdentity = () => {
    const stat = lstatSync(input.path);
    return `${stat.dev}:${stat.ino}`;
  };
  const initialIdentity = fileIdentity();
  db = new Database(input.path, { fileMustExist: true, timeout: 150 });
  db.pragma("trusted_schema = OFF");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = OFF");
  if (marker(db, input.id, input.authority))
    fail(
      "RECOVERY_REQUIRED",
      "A committed marker already exists; reconcile it before retrying.",
    );
  fault("before-backup");
  const fd = openSync(input.backupPath, "wx", 0o600);
  closeSync(fd);
  await db.backup(input.backupPath);
  const backup = new Database(input.backupPath, {
    readonly: true,
    fileMustExist: true,
  });
  let source;
  try {
    validateDatabase(backup);
    source = backup.transaction(() => fingerprints(backup))();
  } finally {
    backup.close();
  }
  if (
    source.schemaFingerprint !== input.plan.schemaFingerprint ||
    source.dataFingerprint !== input.plan.dataFingerprint
  )
    fail(
      "DATABASE_CHANGED",
      "Backup does not match the exact reviewed source state.",
    );
  process.send!({ phase: "backup-validated" });
  fault("after-backup");
  if (input.restorePath)
    db.prepare("ATTACH DATABASE ? AS restore_source").run(input.restorePath);
  db.exec("BEGIN IMMEDIATE");
  const state = fingerprints(db);
  // BEGIN IMMEDIATE holds the attached source against writers as well. Fingerprint
  // the exact attached snapshot consumed by the reviewed restore SQL.
  if (input.restorePath) {
    const restore = fingerprints(db, "restore_source");
    if (
      input.plan.kind !== "restore" ||
      restore.schemaFingerprint !== input.plan.backupFingerprint ||
      restore.dataFingerprint !== input.plan.backupDataFingerprint
    )
      fail("DATABASE_CHANGED", "Reviewed backup changed.");
  }
  if (
    state.schemaFingerprint !== input.plan.schemaFingerprint ||
    state.dataFingerprint !== input.plan.dataFingerprint ||
    source.schemaFingerprint !== state.schemaFingerprint ||
    source.dataFingerprint !== state.dataFingerprint
  )
    fail(
      "DATABASE_CHANGED",
      "Database changed after review or while creating its backup.",
    );
  if (Date.now() >= Date.parse(input.plan.expiresAt))
    fail("PLAN_EXPIRED", "Reviewed plan expired before the write transaction.");
  // Parent confirms the project revision/model while this write transaction is held.
  await new Promise<void>((resolve, reject) => {
    process.once("message", (reply: { proceed?: boolean; code?: string }) =>
      reply.proceed
        ? resolve()
        : reject(
            Object.assign(new Error("Project changed before DDL."), {
              code: reply.code ?? "REVISION_CONFLICT",
            }),
          ),
    );
    process.send!({ phase: "validate-project" });
  });
  if (fileIdentity() !== initialIdentity)
    fail("DATABASE_CHANGED", "Bound SQLite file was replaced before DDL.");
  for (const step of input.plan.steps) {
    if (!step.transactional)
      fail("VALIDATION_FAILED", "Only transactional reviewed SQL may run.");
    db.exec(step.sql);
    fault("during-rebuild");
  }
  validateDatabase(db);
  if (input.plan.kind === "restore") {
    const restored = fingerprints(db);
    if (
      restored.schemaFingerprint !== input.plan.backupFingerprint ||
      restored.dataFingerprint !== input.plan.backupDataFingerprint
    )
      fail(
        "VALIDATION_FAILED",
        "Restored database does not exactly match the reviewed backup.",
      );
  }
  if (
    !db.prepare("SELECT 1 FROM sqlite_schema WHERE name=?").get(markerTable)
  ) {
    db.exec(markerDDL);
    db.prepare(`INSERT INTO "${markerTable}" VALUES(?,?,?,?)`).run(
      "@authority",
      input.authority,
      new Date().toISOString(),
      input.authority,
    );
  }
  db.prepare(`INSERT INTO "${markerTable}" VALUES(?,?,?,?)`).run(
    input.id,
    input.plan.hash,
    new Date().toISOString(),
    fingerprints(db).schemaFingerprint,
  );
  if (fileIdentity() !== initialIdentity)
    fail(
      "DATABASE_CHANGED",
      "Bound SQLite file was replaced during the transaction.",
    );
  fault("before-db-commit");
  db.exec("COMMIT");
  fault("after-db-commit");
  const result = fingerprints(db);
  db.close();
  process.send!({ phase: "committed", result });
  process.disconnect();
} catch (error) {
  if (db?.open) {
    if (db.inTransaction) db.exec("ROLLBACK");
    db.close();
  }
  const code = (error as { code?: string }).code ?? "VALIDATION_FAILED";
  process.send!({
    phase: "failed",
    code:
      code.includes("BUSY") || code.includes("LOCKED")
        ? "PROJECT_BUSY"
        : code.startsWith("SQLITE_")
          ? "VALIDATION_FAILED"
          : code,
  });
  process.disconnect();
}
