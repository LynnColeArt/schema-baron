import { describe, it, expect } from "vitest";
import { constructForm } from "../../src/form-construction/index.js";
import { createId, parseProject, eventSchema } from "@schema-baron/model";
import type { Project } from "@schema-baron/model";
const id = (s: string) => createId(() => s);
function project(): Project {
  return parseProject({
    id: "p",
    formatVersion: 1,
    revision: 1,
    name: "Forms",
    target: "next-typescript-sqlite",
    targetVersion: "1",
    connectionRefs: [],
    connections: [],
    schema: {
      id: "s",
      revision: 1,
      tables: [
        {
          id: "t",
          physicalName: "ledger",
          columns: [
            {
              id: "a",
              physicalName: "tenant",
              type: { kind: "integer" },
              nullable: false,
            },
            {
              id: "b",
              physicalName: "entry",
              type: { kind: "text" },
              nullable: false,
            },
            {
              id: "c",
              physicalName: "enabled",
              type: { kind: "boolean" },
              nullable: true,
            },
          ],
          primaryKey: ["a", "b"],
          foreignKeys: [],
          uniqueConstraints: [],
          checks: [],
          indexes: [],
        },
      ],
      opaqueObjects: [],
    },
    queries: [],
    pages: [
      {
        id: "page",
        title: "Ledger",
        route: "/ledger",
        document: [],
        formIds: [],
      },
    ],
    forms: [],
    controls: [],
    actions: [],
    policies: [
      { id: "policy", scope: "global", ownerId: "p", access: "public" },
    ],
    globalPolicyId: "policy",
    outputConfig: { approvedRootId: "output", relativePath: "app" },
    extensionContracts: [],
  });
}
const input = {
  pageId: id("page"),
  kind: "Record" as const,
  source: { kind: "table" as const, id: id("t") },
  fieldIds: [id("a"), id("b"), id("c")],
  keyIds: [id("a"), id("b")],
  actions: ["update" as const, "cancel" as const],
  links: [],
  style: { label: "Edit ledger" },
};
describe("ordinary form construction", () => {
  it("builds complete typed children in a single whole-candidate revision", () => {
    const p = project(),
      r = constructForm(p, input);
    expect(r.candidate.revision).toBe(2);
    expect(p.forms).toEqual([]);
    expect(
      r.candidate.forms[0]?.keyMapping.map((k) => k.targetFieldId),
    ).toEqual(["a", "b"]);
    expect(r.candidate.controls.some((c) => c.kind === "checkbox")).toBe(true);
    expect(r.candidate.actions.map((a) => a.operation)).toEqual([
      "update",
      "cancel",
    ]);
  });
  it("rejects unordered/incomplete keys with a localized diagnostic and no effects", () => {
    const p = project();
    expect(() =>
      constructForm(p, { ...input, keyIds: [id("b"), id("a")] }),
    ).toThrow();
    expect(p.forms).toHaveLength(0);
  });
  it("creates all four kinds and multiple forms without replacing documents", () => {
    let p = project();
    for (const kind of ["Grid", "Record", "Search", "Login"] as const)
      p = constructForm(p, {
        ...input,
        kind,
        actions: [],
        ...(kind === "Login"
          ? { source: undefined, fieldIds: [], keyIds: [] }
          : {}),
      }).candidate;
    expect(p.forms).toHaveLength(4);
    expect(p.pages[0]?.formIds).toHaveLength(4);
  });
  it("rejects nonexistent fields and query writes atomically", () => {
    expect(() =>
      constructForm(project(), { ...input, fieldIds: [id("absent")] }),
    ).toThrow();
  });
  it("constructs linked record with complete explicit key tuple in one revision", () => {
    const r = constructForm(project(), {
      ...input,
      kind: "Grid",
      actions: [],
      linkedRecord: {
        pageId: id("page"),
        label: "Edit",
        fieldIds: input.fieldIds,
        keyIds: input.keyIds,
      },
    });
    expect(r.candidate.forms).toHaveLength(2);
    expect(r.candidate.revision).toBe(2);
    expect(
      r.candidate.actions
        .find((a) => a.operation === "navigate")
        ?.destination?.keyMapping.map((k) => k.targetFieldId),
    ).toEqual(input.keyIds);
  });
});

it("includes an unsaved parent atomically and rejects invalid wizard choices without saving it", () => {
  const p = project();
  p.pages = [];
  const pending = [
    {
      kind: "put" as const,
      entity: "page" as const,
      id: id("page"),
      value: {
        id: id("page"),
        route: "/new",
        title: "New",
        document: [],
        formIds: [],
      },
    },
  ];
  expect(() =>
    constructForm(p, { ...input, keyIds: [], pendingOperations: pending }),
  ).toThrow();
  expect(p.pages).toEqual([]);
  const result = constructForm(p, { ...input, pendingOperations: pending });
  expect(result.candidate.pages).toHaveLength(1);
  expect(result.candidate.revision).toBe(2);
});

import { ProjectCore } from "../../src/index.js";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
it("public core enforces revision/permission/replay and keeps invalid pending parents out of persistence", async () => {
  const root = mkdtempSync(join(tmpdir(), "form-core-"));
  mkdirSync(join(root, "definitions"));
  const core = new ProjectCore({
    ownerId: "owner",
    metadataRoot: join(root, "metadata"),
    approvedRoots: { projects: join(root, "definitions") },
  });
  try {
    expect(
      core.execute("owner", {
        requestId: "create",
        projectId: "p",
        expectedRevision: 0,
        operation: "project.create",
        input: {
          name: "Forms",
          approvedRoot: "projects",
          target: "next-typescript-sqlite",
        },
      }).ok,
    ).toBe(true);
    const fixture = project();
    expect(
      core.execute("owner", {
        requestId: "schema",
        projectId: "p",
        expectedRevision: 1,
        operation: "project.batch",
        input: {
          operations: [
            {
              kind: "put",
              entity: "table",
              id: "t",
              value: fixture.schema.tables[0],
            },
          ],
        },
      }).ok,
    ).toBe(true);
    const command = {
      requestId: "wizard",
      projectId: "p",
      expectedRevision: 2,
      operation: "form.construct",
      input: {
        ...input,
        pendingOperations: [
          { kind: "put", entity: "page", id: "page", value: fixture.pages[0] },
        ],
      },
    };
    expect(core.execute("intruder", command)).toMatchObject({
      ok: false,
      error: { code: "ACCESS_DENIED" },
    });
    const bad = {
      ...command,
      requestId: "bad",
      input: { ...command.input, keyIds: [] },
    };
    expect(core.execute("owner", bad)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(core.snapshot("owner", "p").pages).toEqual([]);
    const accepted = await core.executeAsync("owner", command);
    expect(accepted).toMatchObject({ ok: true, revision: 3 });
    expect(await core.executeAsync("owner", command)).toEqual(accepted);
    expect(
      core.execute("owner", {
        ...command,
        input: { ...command.input, style: { label: "changed" } },
      }),
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(
      core.execute("owner", { ...command, requestId: "stale" }),
    ).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(core.snapshot("owner", "p").forms).toHaveLength(1);
    expect(
      core
        .events("owner", "p", 0)
        .events.map((e) => eventSchema.parse(e))
        .filter((e) => e.kind === "revision"),
    ).toHaveLength(3);
  } finally {
    await core.close();
    rmSync(root, { recursive: true, force: true });
  }
});

 it("infers name-based single-column lookups without treating composite or ambiguous relationships as scalar", () => {
   const p = project();
   p.schema.tables.push({id:id('parents'),physicalName:'departments',columns:[
     {id:id('parent-key'),physicalName:'code',type:{kind:'integer'},nullable:false},
     {id:id('description'),physicalName:'description',type:{kind:'text'},nullable:false},
     {id:id('parent-name'),physicalName:'name',type:{kind:'text'},nullable:false}
   ],primaryKey:[id('parent-key')],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]});
   const table=p.schema.tables[0]!;
   const fk={id:id('fk'),columnIds:[id('a')],referencedTableId:id('parents'),referencedColumnIds:[id('parent-key')],onUpdate:'restrict' as const,onDelete:'restrict' as const,deferrable:false};
   table.foreignKeys=[fk];
   const control=constructForm(p,input).candidate.controls.find(c=>c.binding?.kind==='stored'&&c.binding.fieldId==='a')!;
   expect(control.kind).toBe('select');
   expect(control.lookup).toEqual({source:{kind:'table',id:'parents'},valueFieldIds:['parent-key'],labelFieldId:'parent-name'});
   expect(constructForm(p,{...input,kind:'Grid',actions:[]}).candidate.controls.every(c=>!c.lookup)).toBe(true);
   table.foreignKeys.push({...fk,id:id('other-fk')});
   expect(constructForm(p,input).candidate.controls.every(c=>!c.lookup)).toBe(true);
   table.foreignKeys=[{...fk,columnIds:[id('a'),id('b')],referencedColumnIds:[id('parent-key'),id('parent-name')]}];
   p.schema.tables[1]!.uniqueConstraints=[{id:id('tuple'),columnIds:[id('parent-key'),id('parent-name')]}];
   expect(constructForm(p,input).candidate.controls.every(c=>!c.lookup)).toBe(true);
 });
