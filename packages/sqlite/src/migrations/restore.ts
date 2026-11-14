import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import type { Inspection } from "../introspection/index.js";
const url = new URL("./state.js", import.meta.url);
const { fingerprints, validateDatabase } = (await import(
  existsSync(url) ? url.href : new URL("./state.ts", import.meta.url).href
)) as typeof import("./state.js");
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
/** Build exact backup DDL/copy statements. The reviewed executor binds only the
 * owner-selected backup as restore_source; no client SQL enters this path. */
export function restoreStatements(path: string, current: Inspection) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return db.transaction(() => {
      validateDatabase(db);
      const backup = fingerprints(db);
      const steps: string[] = [];
      if (
        backup.inspection.objects.some((o) =>
          /\bCREATE\s+VIRTUAL\s+TABLE\b/i.test(o.sql ?? ""),
        )
      )
        throw Object.assign(
          new Error(
            "Restoring virtual tables is unsupported; preserve this backup for explicit external recovery.",
          ),
          { code: "UNSUPPORTED_SCHEMA_OBJECT" },
        );
      for (const kind of ["view", "trigger", "index", "table"])
        for (const o of current.objects.filter(
          (o) => o.type === kind && !o.name.startsWith("sqlite_"),
        ))
          steps.push(`DROP ${kind.toUpperCase()} ${quote(o.name)}`);
      for (const table of backup.inspection.tables) {
        const object = backup.inspection.objects.find(
          (o) => o.type === "table" && o.name === table.name,
        );
        if (!object?.sql)
          throw Object.assign(new Error("Backup lacks complete table DDL."), {
            code: "UNSUPPORTED_SCHEMA_OBJECT",
          });
        steps.push(object.sql);
        const columns = table.columns
          .filter((c) => !c.hidden)
          .map((c) => c.name);
        const rowid = ["rowid", "_rowid_", "oid"].find(
          (n) => !table.columns.some((c) => c.name.toLowerCase() === n),
        );
        if (rowid && !/\bWITHOUT\s+ROWID\b/i.test(object.sql))
          columns.unshift(rowid);
        const list = columns.map(quote).join(", ");
        steps.push(
          `INSERT INTO main.${quote(table.name)} (${list}) SELECT ${list} FROM restore_source.${quote(table.name)}`,
        );
      }
      for (const o of backup.inspection.objects.filter(
        (o) =>
          ["index", "view", "trigger"].includes(o.type) &&
          o.sql &&
          !o.name.startsWith("sqlite_"),
      ))
        steps.push(o.sql!);
      if (backup.inspection.objects.some((o) => o.name === "sqlite_sequence")) {
        steps.push(
          "DELETE FROM sqlite_sequence",
          "INSERT INTO sqlite_sequence SELECT * FROM restore_source.sqlite_sequence",
        );
      }
      return { backup, steps };
    })();
  } finally {
    db.close();
  }
}
