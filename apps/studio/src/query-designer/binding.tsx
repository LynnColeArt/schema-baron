import { ScalarInput } from "./scalar.js";
import type { Form, Project, LiteralValue } from "@schema-baron/model";
/** Saved pre-query literal inputs; dynamic request/control mappings need a future typed input context. */
export function QueryBinding({
  form,
  project,
  onChange,
}: {
  form: Form;
  project: Project;
  onChange: (f: Form) => void;
}) {
  const query =
    form.sourceRef?.kind === "query"
      ? project.queries.find((q) => q.id === form.sourceRef!.id)
      : undefined;
  if (!query) return null;
  function set(id: string, value: LiteralValue | undefined) {
    const rest = (form.queryParameters ?? []).filter(
      (m) => m.parameterId !== id,
    );
    const p = query!.parameters.find((p) => p.id === id)!;
    onChange({
      ...form,
      queryParameters:
        value === undefined ? rest : [...rest, { parameterId: p.id, value }],
    });
  }
  return (
    <fieldset>
      <legend>Query parameter inputs</legend>
      <p>
        Saved literal values are bound before the query runs. Blank unmapped
        inputs use query defaults or require a preview value. Row fields cannot
        supply their own query parameters.
      </p>
      {query.parameters.map((p) => {
        const mapping = form.queryParameters?.find(
          (m) => m.parameterId === p.id,
        );
        return (
          <div key={p.id}>
            <label>
              <input
                aria-label={`Map ${p.name}`}
                type="checkbox"
                checked={!!mapping}
                onChange={(e) =>
                  set(
                    p.id,
                    e.target.checked
                      ? p.default !== undefined
                        ? p.default
                        : p.type.kind === "boolean"
                          ? false
                          : ["integer", "real"].includes(p.type.kind)
                            ? 0
                            : ""
                      : undefined,
                  )
                }
              />
              {p.name} · {p.type.kind}
            </label>
            {mapping && (
              <>
                <label>
                  Value
                  <ScalarInput
                    label={`Mapped ${p.name}`}
                    value={mapping.value}
                    type={p.type}
                    onChange={(v) => set(p.id, v)}
                  />
                </label>
                {p.nullable && (
                  <label>
                    <input
                      type="checkbox"
                      checked={mapping.value === null}
                      onChange={(e) => set(p.id, e.target.checked ? null : "")}
                    />
                    Null input
                  </label>
                )}
              </>
            )}
          </div>
        );
      })}
      {form.queryParameters
        ?.filter((m) => !query.parameters.some((p) => p.id === m.parameterId))
        .map((m) => (
          <p role="alert" key={m.parameterId}>
            Missing query parameter.{" "}
            <button
              onClick={() =>
                onChange({
                  ...form,
                  queryParameters: form.queryParameters!.filter((x) => x !== m),
                })
              }
            >
              Remove missing mapping
            </button>
          </p>
        ))}
    </fieldset>
  );
}
