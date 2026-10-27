import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { Inspection } from "../introspection/index.js";
const url = new URL("../introspection/index.js", import.meta.url);
const { inspectDatabase } = (await import(
  existsSync(url)
    ? url.href
    : new URL("../introspection/index.ts", import.meta.url).href
)) as typeof import("../introspection/index.js");
export const markerTable = "__schema_baron_migrations";
export const markerDDL = `CREATE TABLE "${markerTable}" (id TEXT PRIMARY KEY NOT NULL, plan_hash TEXT NOT NULL, committed_at TEXT NOT NULL, schema_hash TEXT NOT NULL)`;
export function checkMarkerTable(db: Database.Database, authority?: string) {
  const object = db
    .prepare("SELECT sql FROM sqlite_schema WHERE name=?")
    .get(markerTable) as { sql: string } | undefined;
  if (
    object &&
    (object.sql !== markerDDL ||
      (authority !== undefined &&
        (
          db
            .prepare(
              `SELECT plan_hash FROM "${markerTable}" WHERE id='@authority'`,
            )
            .get() as { plan_hash: string } | undefined
        )?.plan_hash !== authority))
  )
    throw Object.assign(
      new Error("Reserved migration marker name is occupied."),
      { code: "UNSUPPORTED_SCHEMA_OBJECT" },
    );
}
export function marker(
  db: Database.Database,
  id: string,
  authority?: string,
):
  { plan_hash: string; committed_at: string; schema_hash: string } | undefined {
  checkMarkerTable(db, authority);
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name=?").get(markerTable))
    return;
  return db
    .prepare(
      `SELECT plan_hash, committed_at, schema_hash FROM "${markerTable}" WHERE id=?`,
    )
    .get(id) as
    | { plan_hash: string; committed_at: string; schema_hash: string }
    | undefined;
}
export function fingerprints(
  db: Database.Database,
  schema: "main" | "restore_source" = "main",
): {
  inspection: Inspection;
  schemaFingerprint: string;
  dataFingerprint: string;
  rowCount: number;
} {
  checkMarkerTable(db);
  const inspection = inspectDatabase(db, schema);
  const digest = createHash("sha256");
  let rowCount = 0;
  const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
  for (const table of [...inspection.tables].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    digest.update(JSON.stringify(table.name));
    const rowid = ["rowid", "_rowid_", "oid"].find(
      (name) => !table.columns.some((c) => c.name.toLowerCase() === name),
    );
    const without = /\bWITHOUT\s+ROWID\b/i.test(
      inspection.objects.find((o) => o.name === table.name)?.sql ?? "",
    );
    const rows = db
      .prepare(
        `SELECT ${rowid && !without ? quote(rowid) + ", " : ""}* FROM ${schema}.${quote(table.name)}`,
      )
      .safeIntegers()
      .raw()
      .iterate();
    const hashes: string[] = [];
    for (const row of rows) {
      rowCount++;
      hashes.push(
        createHash("sha256")
          .update(
            JSON.stringify(row, (_k, v: unknown) =>
              typeof v === "bigint" ? { integer: String(v) } : v,
            ),
          )
          .digest("hex"),
      );
    }
    hashes.sort();
    for (const value of hashes) digest.update(value);
  }
  return {
    inspection,
    schemaFingerprint: inspection.fingerprint,
    dataFingerprint: digest.digest("hex"),
    rowCount,
  };
}
export function observed(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return db.transaction(() => fingerprints(db))();
  } finally {
    db.close();
  }
}
export function committed(path: string, id: string, authority?: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return marker(db, id, authority);
  } finally {
    db.close();
  }
}
export function validateDatabase(db: Database.Database) {
  if (
    (db.pragma("foreign_key_check") as unknown[]).length ||
    JSON.stringify(db.pragma("integrity_check")) !==
      JSON.stringify([{ integrity_check: "ok" }])
  )
    throw Object.assign(
      new Error("Database validation failed; transaction rolled back."),
      { code: "VALIDATION_FAILED" },
    );
}
