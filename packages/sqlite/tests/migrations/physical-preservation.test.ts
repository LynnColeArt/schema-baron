import { test, expect } from "vitest";
import { createId } from "@schema-baron/model";
import { fixture } from "./fixture.js";
const cases = [
  "k INT NOT NULL PRIMARY KEY,v TEXT",
  "k INTEGER PRIMARY KEY DESC NOT NULL,v TEXT",
  "k INTEGER PRIMARY KEY,v TEXT",
  "k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k DESC,v ASC)",
  "k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k ASC,v DESC)",
] as const;
test.each(cases)(
  "actual apply retains physical keys, independent rowids, directions and future NULL behavior: %s",
  async (definition) => {
    const f = await fixture(
      `CREATE TABLE t(${definition});INSERT INTO t(rowid,k,v) VALUES(50,7,'kept')`,
      (schema) =>
        schema.tables[0]!.columns.push({
          id: createId(),
          physicalName: "added",
          type: { kind: "text" },
          nullable: true,
        }),
    );
    try {
      const keys = () => {
        const indexes = f.db.pragma("index_list(t)") as {
          name: string;
          origin: string;
        }[];
        return indexes
          .filter((i) => i.origin === "pk")
          .map((i) =>
            f.db
              .prepare(
                "SELECT seqno,cid,name,desc,coll,key FROM pragma_index_xinfo(?) ORDER BY seqno",
              )
              .all(i.name),
          );
      };
      const nullBehavior = () => {
        f.db.exec("SAVEPOINT null_trial");
        try {
          try {
            f.db.exec("INSERT INTO t(k) VALUES(NULL)");
            return {
              accepted: true,
              rows: f.db.prepare("SELECT rowid,k FROM t ORDER BY rowid").all(),
            };
          } catch (e) {
            return { accepted: false, code: (e as { code: string }).code };
          }
        } finally {
          f.db.exec("ROLLBACK TO null_trial;RELEASE null_trial");
        }
      };
      const before = {
        rows: f.db.prepare("SELECT rowid AS identity,* FROM t").all(),
        keys: keys(),
        nullBehavior: nullBehavior(),
        columns: f.db.pragma("table_xinfo(t)"),
      };
      expect(await f.run("schema.apply", f.apply, 3)).toMatchObject({
        ok: true,
        revision: 4,
        result: { committed: true },
      });
      expect(f.db.prepare("SELECT rowid AS identity,k,v FROM t").all()).toEqual(
        before.rows,
      );
      expect(keys()).toEqual(before.keys);
      expect(nullBehavior()).toEqual(before.nullBehavior);
      expect((f.db.pragma("table_xinfo(t)") as unknown[]).slice(0, 2)).toEqual(
        before.columns,
      );
    } finally {
      await f.close();
    }
  },
);
