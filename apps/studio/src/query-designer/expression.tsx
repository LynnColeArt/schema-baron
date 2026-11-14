import { arithmeticResultType } from '@schema-baron/model';
import { ScalarInput } from "./scalar.js";
import type {
  Expression,
  Query,
  Project,
  ScalarType,
  StableId,
} from "@schema-baron/model";
export const literal = (): Expression => ({
  kind: "literal",
  value: 0,
  type: { kind: "integer" },
});
export function fields(project: Project, query: Query) {
  return query.sources.flatMap(
    (s) =>
      (s.source.kind === "table"
        ? project.schema.tables
            .find((t) => t.id === s.source.id)
            ?.columns.map((c) => ({ ...c, name: c.physicalName }))
        : project.queries.find((q) => q.id === s.source.id)?.projections
      )?.map((f) => ({
        ...f,
        alias: s.alias,
        nullable:
          f.nullable ||
          query.joins.some(
            (j) => j.rightAlias === s.alias && j.kind === "left",
          ),
      })) ?? [],
  );
}
export function shape(
  e: Expression,
  project: Project,
  q: Query,
): { type: ScalarType; nullable: boolean } {
  if (e.kind === "literal") return { type: e.type, nullable: e.value === null };
  if (e.kind === "field") {
    const f = fields(project, q).find(
      (f) => f.id === e.fieldId && f.alias === e.alias,
    );
    return f
      ? { type: f.type, nullable: f.nullable }
      : { type: { kind: "text" }, nullable: true };
  }
  if (e.kind === "parameter") {
    const p = q.parameters.find((p) => p.id === e.parameterId);
    return p
      ? { type: p.type, nullable: p.nullable }
      : { type: { kind: "text" }, nullable: true };
  }
  if (e.kind === "aggregate") {
    if (e.function === "count")
      return { type: { kind: "integer" }, nullable: false };
    const a = e.argument
      ? shape(e.argument, project, q)
      : { type: { kind: "integer" } as ScalarType, nullable: true };
    return {
      ...a,
      type:
        e.function === "avg" && a.type.kind !== "decimal"
          ? { kind: "real" }
          : a.type,
      nullable: e.zeroChildren !== "zero",
    };
  }
  if (e.kind === "binary") {
    if (["=", "!=", "<", "<=", ">", ">=", "and", "or"].includes(e.operator))
      return {
        type: { kind: "boolean" },
        nullable:
          shape(e.left, project, q).nullable ||
          shape(e.right, project, q).nullable,
      };
    return {
      type: arithmeticResultType(shape(e.left, project, q).type, shape(e.right, project, q).type) ?? shape(e.left, project, q).type,
      nullable:
        shape(e.left, project, q).nullable ||
        shape(e.right, project, q).nullable,
    };
  }
  const a = shape(e.args[0] ?? literal(), project, q);
  return {
    type: ["length", "year"].includes(e.function)
      ? { kind: "integer" }
      : e.function === "date"
        ? { kind: "date", encoding: "iso-date" }
        : a.type,
    nullable:
      e.function === "coalesce"
        ? e.args.every((x) => shape(x, project, q).nullable)
        : a.nullable,
  };
}
export function TypeEditor({
  value,
  onChange,
  label,
}: {
  value: ScalarType;
  onChange: (v: ScalarType) => void;
  label: string;
}) {
  return (
    <span className="qd-type">
      <select
        aria-label={label}
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value;
          onChange(
            kind === "decimal"
              ? {
                  kind,
                  precision: 18,
                  scale: 2,
                  encoding: "text",
                  rounding: "half-even",
                }
              : kind === "date"
                ? { kind, encoding: "iso-date" }
                : kind === "datetime"
                  ? { kind, encoding: "iso-utc" }
                  : ({ kind } as ScalarType),
          );
        }}
      >
        {[
          "integer",
          "real",
          "text",
          "blob",
          "boolean",
          "decimal",
          "date",
          "datetime",
        ].map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      {value.kind === "decimal" && (
        <>
          <input
            aria-label={`${label} scale`}
            type="number"
            min="0"
            max="18"
            value={value.scale}
            onChange={(e) =>
              onChange({ ...value, scale: Number(e.target.value) })
            }
          />
          <input
            aria-label={`${label} precision`}
            type="number"
            min="1"
            max="38"
            value={value.precision}
            onChange={(e) =>
              onChange({ ...value, precision: Number(e.target.value) })
            }
          />
          <select
            aria-label={`${label} encoding`}
            value={value.encoding}
            onChange={(e) =>
              onChange({
                ...value,
                encoding: e.target.value as "text" | "scaled-integer",
              })
            }
          >
            <option value="text">text</option>
            <option value="scaled-integer">scaled-integer</option>
          </select>
          <select
            aria-label={`${label} rounding`}
            value={value.rounding}
            onChange={(e) =>
              onChange({
                ...value,
                rounding: e.target.value as "half-up" | "half-even" | "down",
              })
            }
          >
            {["half-even", "half-up", "down"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </>
      )}
    </span>
  );
}
export function ExpressionEditor({
  value,
  onChange,
  project,
  query,
  label,
}: {
  value: Expression;
  onChange: (v: Expression) => void;
  project: Project;
  query: Query;
  label: string;
}) {
  const list = fields(project, query),
    child = (
      v: Expression,
      change: (e: Expression) => void,
      suffix: string,
    ) => (
      <ExpressionEditor
        value={v}
        onChange={change}
        project={project}
        query={query}
        label={`${label} ${suffix}`}
      />
    );
  return (
    <fieldset className="qd-expression">
      <legend>{label}</legend>
      <select
        aria-label={`${label} kind`}
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value;
          onChange(
            kind === "field"
              ? {
                  kind,
                  alias: list[0]?.alias ?? "",
                  fieldId: list[0]?.id ?? ("" as StableId),
                }
              : kind === "parameter"
                ? {
                    kind,
                    parameterId: query.parameters[0]?.id ?? ("" as StableId),
                  }
                : kind === "binary"
                  ? { kind, operator: "=", left: literal(), right: literal() }
                  : kind === "aggregate"
                    ? {
                        kind,
                        function: "sum",
                        argument: literal(),
                        zeroChildren: "zero",
                      }
                    : kind === "function"
                      ? {
                          kind,
                          function: "coalesce",
                          args: [literal(), literal()],
                        }
                      : literal(),
          );
        }}
      >
        {[
          "field",
          "literal",
          "parameter",
          "binary",
          "aggregate",
          "function",
        ].map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      {value.kind === "field" && (
        <select
          aria-label={`${label} field`}
          value={`${value.alias}:${value.fieldId}`}
          onChange={(e) => {
            const f = list.find((f) => `${f.alias}:${f.id}` === e.target.value);
            if (f) onChange({ kind: "field", alias: f.alias, fieldId: f.id });
          }}
        >
          <option value="">Choose field</option>
          {list.map((f) => (
            <option key={`${f.alias}:${f.id}`} value={`${f.alias}:${f.id}`}>
              {f.alias}.{f.name}
            </option>
          ))}
        </select>
      )}
      {value.kind === "parameter" && (
        <select
          aria-label={`${label} parameter`}
          value={value.parameterId}
          onChange={(e) =>
            onChange({ ...value, parameterId: e.target.value as StableId })
          }
        >
          <option value="">Choose parameter</option>
          {query.parameters.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {value.kind === "literal" && (
        <>
          <TypeEditor
            label={`${label} type`}
            value={value.type}
            onChange={(type) => onChange({ ...value, type })}
          />
          <ScalarInput
            label={`${label} value`}
            value={value.value}
            type={value.type}
            onChange={(v) => onChange({ ...value, value: v })}
          />
          <label>
            <input
              type="checkbox"
              checked={value.value === null}
              onChange={(e) =>
                onChange({ ...value, value: e.target.checked ? null : "" })
              }
            />
            Null literal
          </label>
        </>
      )}
      {value.kind === "binary" && (
        <>
          <select
            aria-label={`${label} operator`}
            value={value.operator}
            onChange={(e) =>
              onChange({
                ...value,
                operator: e.target.value as typeof value.operator,
              })
            }
          >
            {[
              "+",
              "-",
              "*",
              "/",
              "=",
              "!=",
              "<",
              "<=",
              ">",
              ">=",
              "and",
              "or",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {child(value.left, (left) => onChange({ ...value, left }), "left")}
          {child(
            value.right,
            (right) => onChange({ ...value, right }),
            "right",
          )}
        </>
      )}
      {value.kind === "aggregate" && (
        <>
          <select
            aria-label={`${label} aggregate`}
            value={value.function}
            onChange={(e) =>
              onChange({
                ...value,
                function: e.target.value as typeof value.function,
              })
            }
          >
            {["sum", "count", "min", "max", "avg"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={!!value.argument}
              onChange={(e) =>
                onChange({
                  ...value,
                  argument: e.target.checked ? literal() : undefined,
                })
              }
            />
            Argument (count only permits none)
          </label>
          {value.argument &&
            child(
              value.argument,
              (argument) => onChange({ ...value, argument }),
              "argument",
            )}
          <label>
            <input
              type="checkbox"
              checked={!!value.distinct}
              onChange={(e) =>
                onChange({ ...value, distinct: e.target.checked })
              }
            />
            Distinct
          </label>
          <select
            aria-label={`${label} zero children`}
            value={value.zeroChildren ?? "null"}
            onChange={(e) =>
              onChange({
                ...value,
                zeroChildren: e.target.value as "zero" | "null",
              })
            }
          >
            <option value="zero">Zero for no children</option>
            <option value="null">Null for no children</option>
          </select>
        </>
      )}
      {value.kind === "function" && (
        <>
          <select
            aria-label={`${label} function`}
            value={value.function}
            onChange={(e) =>
              onChange({
                ...value,
                function: e.target.value as typeof value.function,
              })
            }
          >
            {[
              "coalesce",
              "lower",
              "upper",
              "length",
              "abs",
              "date",
              "year",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {value.args.map((a, i) => (
            <div key={i}>
              {child(
                a,
                (v) =>
                  onChange({
                    ...value,
                    args: value.args.map((x, n) => (n === i ? v : x)),
                  }),
                `argument ${i + 1}`,
              )}
              <button
                onClick={() =>
                  onChange({
                    ...value,
                    args: value.args.filter((_, n) => n !== i),
                  })
                }
              >
                Remove argument
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({ ...value, args: [...value.args, literal()] })
            }
          >
            Add argument
          </button>
        </>
      )}
    </fieldset>
  );
}
