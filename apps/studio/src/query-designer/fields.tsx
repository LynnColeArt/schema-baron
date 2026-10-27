import { createId } from "@schema-baron/model";
import type { Query, Project, Expression } from "@schema-baron/model";
import { shape, TypeEditor, ExpressionEditor, literal } from "./expression.js";
export function QueryFields({
  q,
  project,
  update,
}: {
  q: Query;
  project: Project;
  update: (q: Query) => void;
}) {
  const expression = (
    value: Expression,
    onChange: (e: Expression) => void,
    label: string,
  ) => (
    <ExpressionEditor
      value={value}
      onChange={onChange}
      project={project}
      query={q}
      label={label}
    />
  );
  return (
    <>
      <h2>Projection and grain</h2>
      <p>
        Supported expressions: fields, typed literals, parameters,
        arithmetic/comparison/and/or, count/sum/min/max/avg,
        coalesce/lower/upper/length/abs/date/year. SQL is compiled by the
        service.
      </p>
      <label>
        Aggregate grain
        <select
          aria-label="Aggregate grain"
          value={q.grain.strategy}
          onChange={(e) =>
            update({
              ...q,
              grain:
                e.target.value === "preaggregated"
                  ? {
                      strategy: "preaggregated",
                      keys: q.grain.keys,
                      sourceAliases: [],
                    }
                  : {
                      strategy: e.target.value as "rows" | "grouped",
                      keys: q.grain.keys,
                    },
            })
          }
        >
          {["rows", "grouped", "preaggregated"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <p>Declare grain keys using stable projected fields:</p>
      {q.projections.map((p) => (
        <label key={p.id}>
          <input
            type="checkbox"
            checked={q.grain.keys.includes(p.id)}
            onChange={(e) =>
              update({
                ...q,
                grain: {
                  ...q.grain,
                  keys: e.target.checked
                    ? [...q.grain.keys, p.id]
                    : q.grain.keys.filter((id) => id !== p.id),
                },
              })
            }
          />
          {p.name}
        </label>
      ))}
      {q.grain.strategy === "preaggregated" &&
        q.sources.map((s) => (
          <label key={s.alias}>
            <input
              type="checkbox"
              checked={
                q.grain.strategy === "preaggregated" &&
                q.grain.sourceAliases.includes(s.alias)
              }
              onChange={(e) => {
                if (q.grain.strategy === "preaggregated")
                  update({
                    ...q,
                    grain: {
                      ...q.grain,
                      sourceAliases: e.target.checked
                        ? [...q.grain.sourceAliases, s.alias]
                        : q.grain.sourceAliases.filter((a) => a !== s.alias),
                    },
                  });
              }}
            />
            {s.alias} preaggregated source
          </label>
        ))}
      <button
        onClick={() =>
          update({
            ...q,
            projections: [
              ...q.projections,
              {
                id: createId(),
                name: `field${q.projections.length + 1}`,
                type: { kind: "integer" },
                nullable: false,
                expression: literal(),
              },
            ],
          })
        }
      >
        Add projection
      </button>
      {q.projections.map((p, i) => (
        <fieldset key={p.id} id={`query-field-${p.id}`} tabIndex={-1}>
          <legend>Projection {i + 1}</legend>
          <label>
            Name
            <input
              aria-label={`Projection ${i + 1} name`}
              value={p.name}
              onChange={(e) =>
                update({
                  ...q,
                  projections: q.projections.map((x) =>
                    x.id === p.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          {expression(
            p.expression,
            (e) => {
              const inferred = shape(e, project, q);
              update({
                ...q,
                projections: q.projections.map((x) =>
                  x.id === p.id ? { ...x, expression: e, ...inferred } : x,
                ),
              });
            },
            `Projection ${i + 1}`,
          )}
          <TypeEditor
            label={`Projection ${i + 1} output type`}
            value={p.type}
            onChange={(type) =>
              update({
                ...q,
                projections: q.projections.map((x) =>
                  x.id === p.id ? { ...x, type } : x,
                ),
              })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={p.nullable}
              onChange={(e) =>
                update({
                  ...q,
                  projections: q.projections.map((x) =>
                    x.id === p.id ? { ...x, nullable: e.target.checked } : x,
                  ),
                })
              }
            />
            Nullable output
          </label>
          <button
            onClick={() =>
              update({
                ...q,
                groupBy: [...q.groupBy, p.expression],
              })
            }
          >
            Group by projection {i + 1}
          </button>
          <button
            onClick={() =>
              update({
                ...q,
                orderBy: [
                  ...q.orderBy,
                  { expression: p.expression, direction: "asc" },
                ],
              })
            }
          >
            Order by projection {i + 1}
          </button>
          <button
            onClick={() =>
              update({
                ...q,
                projections: q.projections.filter((x) => x.id !== p.id),
              })
            }
          >
            Remove projection {i + 1}
          </button>
        </fieldset>
      ))}
      {(["where", "having"] as const).map((k) => (
        <fieldset key={k}>
          <legend>
            {k === "where"
              ? "WHERE · before grouping"
              : "HAVING · after grouping"}
          </legend>
          {q[k] ? (
            <>
              {expression(
                q[k]!,
                (e) => update({ ...q, [k]: e }),
                k.toUpperCase(),
              )}
              <button
                onClick={() => {
                  const next = { ...q };
                  delete next[k];
                  update(next);
                }}
              >
                Remove {k}
              </button>
            </>
          ) : (
            <button onClick={() => update({ ...q, [k]: literal() })}>
              Add {k}
            </button>
          )}
        </fieldset>
      ))}
      <h3>Group by</h3>
      {q.groupBy.map((g, i) => (
        <div key={i}>
          {expression(
            g,
            (e) =>
              update({
                ...q,
                groupBy: q.groupBy.map((x, n) => (n === i ? e : x)),
              }),
            `Group ${i + 1}`,
          )}
          <button
            onClick={() =>
              update({
                ...q,
                groupBy: q.groupBy.filter((_, n) => n !== i),
              })
            }
          >
            Remove group {i + 1}
          </button>
        </div>
      ))}
      <button
        onClick={() => update({ ...q, groupBy: [...q.groupBy, literal()] })}
      >
        Add group expression
      </button>
      <h3>Order by</h3>
      {q.orderBy.map((g, i) => (
        <div key={i}>
          {expression(
            g.expression,
            (e) =>
              update({
                ...q,
                orderBy: q.orderBy.map((x, n) =>
                  n === i ? { ...x, expression: e } : x,
                ),
              }),
            `Sort ${i + 1}`,
          )}
          <select
            aria-label={`Sort ${i + 1} direction`}
            value={g.direction}
            onChange={(e) =>
              update({
                ...q,
                orderBy: q.orderBy.map((x, n) =>
                  n === i
                    ? {
                        ...x,
                        direction: e.target.value as "asc" | "desc",
                      }
                    : x,
                ),
              })
            }
          >
            <option>asc</option>
            <option>desc</option>
          </select>
          <button
            onClick={() =>
              update({
                ...q,
                orderBy: q.orderBy.filter((_, n) => n !== i),
              })
            }
          >
            Remove sort {i + 1}
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          update({
            ...q,
            orderBy: [
              ...q.orderBy,
              { expression: literal(), direction: "asc" },
            ],
          })
        }
      >
        Add sort expression
      </button>
    </>
  );
}
