import { existsSync } from "node:fs";
import Database from "better-sqlite3";
const stateUrl = new URL("./state.js", import.meta.url),
  restoreUrl = new URL("./restore.js", import.meta.url);
const { fingerprints } = (await import(
  existsSync(stateUrl)
    ? stateUrl.href
    : new URL("./state.ts", import.meta.url).href
)) as typeof import("./state.js");
const { restoreStatements } = (await import(
  existsSync(restoreUrl)
    ? restoreUrl.href
    : new URL("./restore.ts", import.meta.url).href
)) as typeof import("./restore.js");
const input = JSON.parse(process.env.SCHEMA_BARON_MIGRATION_WORKER!) as {
  path: string;
  backupPath: string;
};
let db: Database.Database | undefined;
process.on("disconnect", () => {
  if (db?.open) db.close();
  process.exit(0);
});
try {
  db = new Database(input.path, {
    readonly: true,
    fileMustExist: true,
    timeout: 150,
  });
  const result = db.transaction(() => {
    const current = fingerprints(db!);
    return {
      current,
      ...restoreStatements(input.backupPath, current.inspection),
    };
  })();
  db.close();
  process.send!({ phase: "committed", result });
  process.disconnect();
} catch (error) {
  if (db?.open) db.close();
  process.send!({
    phase: "failed",
    code: (error as { code?: string }).code ?? "VALIDATION_FAILED",
  });
  process.disconnect();
}
