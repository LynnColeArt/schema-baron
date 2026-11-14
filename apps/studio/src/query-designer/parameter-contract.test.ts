import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandSchema, validateProject } from "@schema-baron/model";
const fixture = () => {
  const p = JSON.parse(
    readFileSync(
      new URL("../../../../fixtures/model/project.json", import.meta.url),
      "utf8",
    ),
  );
  const q = p.queries[0];
  q.parameters = [
    {
      id: "minimum-param",
      name: "minimum",
      type: { kind: "integer" },
      nullable: false,
      default: 0,
    },
  ];
  const f =
    p.forms.find(
      (f: { sourceRef?: { kind: string } }) => f.sourceRef?.kind === "query",
    ) ?? p.forms[0];
  f.sourceRef = { kind: "query", id: q.id };
  f.keyMapping = [];
  f.search = [];
  f.sorting = [];
  p.controls = p.controls.filter((c: { formId: string }) => c.formId !== f.id);
  f.controlIds = [];
  p.actions = p.actions.filter((a: { formId: string }) => a.formId !== f.id);
  f.actionIds = [];
  f.queryParameters = [{ parameterId: "minimum-param", value: 5 }];
  return { p, f, q };
};
describe("saved form query parameters are pre-query literal inputs", () => {
  it("accepts public batch values and preserves stable IDs on query/parameter rename", () => {
    const { p, f, q } = fixture();
    expect(validateProject(p).ok).toBe(true);
    expect(
      commandSchema.safeParse({
        requestId: "request",
        projectId: p.id,
        expectedRevision: p.revision,
        operation: "project.batch",
        input: {
          operations: [{ kind: "put", entity: "form", id: f.id, value: f }],
        },
      }).success,
    ).toBe(true);
    q.name = "Renamed";
    q.parameters[0].name = "Renamed minimum";
    expect(validateProject(p).ok).toBe(true);
  });
  it.each([
    "duplicate",
    "missing",
    "wrong-type",
    "null",
    "wrong-source",
    "result-expression",
  ])("rejects %s before persistence", (defect) => {
    const { p, f } = fixture();
    if (defect === "duplicate")
      f.queryParameters.push({ ...f.queryParameters[0] });
    if (defect === "missing") f.queryParameters[0].parameterId = "gone";
    if (defect === "wrong-type") f.queryParameters[0].value = "bad";
    if (defect === "null") f.queryParameters[0].value = null;
    if (defect === "wrong-source")
      f.sourceRef = { kind: "table", id: p.schema.tables[0].id };
    if (defect === "result-expression")
      f.queryParameters[0] = {
        parameterId: "minimum-param",
        expression: {
          kind: "field",
          alias: "root",
          fieldId: p.queries[0].projections[0].id,
        },
      };
    expect(validateProject(p).ok).toBe(false);
  });
  it("allows explicit null only for nullable input and diagnoses removed parameter IDs", () => {
    const { p, f, q } = fixture();
    q.parameters[0].nullable = true;
    f.queryParameters[0].value = null;
    expect(validateProject(p).ok).toBe(true);
    q.parameters = [];
    expect(validateProject(p).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "BROKEN_REFERENCE",
        objectId: f.id,
        field: "queryParameters.parameterId",
      }),
    );
  });
});
