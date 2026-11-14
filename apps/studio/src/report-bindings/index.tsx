import {queryInputs} from '@schema-baron/model';
import { ScalarInput } from "../query-designer/scalar.js";
import type { Form, Project, LiteralValue } from "@schema-baron/model";
/** Canonical query-backed Grid properties. Inputs are evaluated before any result row. */
export function ReportBindings({
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
  const inputs=queryInputs(project,query.id);
  function set(id: string, value: LiteralValue | undefined) {
    const rest = (form.queryParameters ?? []).filter(
      (m) => m.parameterId !== id,
    );
    const p = inputs.find((p) => p.id === id)!;
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
        Choose a fixed literal or a named public runtime input. Unmapped inputs use query defaults. Runtime inputs distinguish an omitted default, an explicit value (including blank text), and null.
      </p>
      {inputs.map((p) => {
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
            <label>Input source<select aria-label={`Input source ${p.name}`} value={mapping?.runtime?'runtime':mapping?'literal':'default'} onChange={event=>{const rest=(form.queryParameters??[]).filter(m=>m.parameterId!==p.id);onChange({...form,queryParameters:event.target.value==='default'?rest:[...rest,event.target.value==='runtime'?{parameterId:p.id,runtime:{name:'input'+(inputs.indexOf(p)+1)}}:{parameterId:p.id,value:p.default??(p.type.kind==='boolean'?false:['integer','real'].includes(p.type.kind)?0:p.type.kind==='decimal'?'0':'')}]});}}><option value="default">Query default</option><option value="literal">Fixed literal</option><option value="runtime">Runtime filter</option></select></label>
            {mapping?.runtime&&<label>Runtime name<input aria-label={`Runtime name ${p.name}`} value={mapping.runtime.name} onChange={event=>onChange({...form,queryParameters:form.queryParameters!.map(m=>m.parameterId===p.id?{parameterId:p.id,runtime:{name:event.target.value}}:m)})} /></label>}
            {mapping && !mapping.runtime && (
              <>
                <label>
                  Value
                  <ScalarInput
                    label={`Mapped ${p.name}`}
                    value={mapping.value ?? ""}
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
        ?.filter((m) => !inputs.some((p) => p.id === m.parameterId))
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
