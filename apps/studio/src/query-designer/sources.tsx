import type { Dispatch, SetStateAction } from "react";
import type { Query, Project, Expression } from "@schema-baron/model";
import { fields, ExpressionEditor, literal } from "./expression.js";
import { renameAlias } from "./state.js";
export function QuerySources({
  q,
  project,
  update,
  positions,
  setPositions,
}: {
  q: Query;
  project: Project;
  update: (q: Query) => void;
  positions: Record<string, { x: number; y: number }>;
  setPositions: Dispatch<
    SetStateAction<Record<string, { x: number; y: number }>>
  >;
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
  const sources = [
    ...project.schema.tables.map((t) => ({
      kind: "table" as const,
      id: t.id,
      name: t.physicalName,
    })),
    ...project.queries
      .filter((s) => s.id !== q?.id)
      .map((s) => ({ kind: "query" as const, id: s.id, name: s.name })),
  ];

  return (
    <>
      <h2>Sources and joins</h2>
      <label>
        Add source
        <select
          aria-label="Add source"
          value=""
          onChange={(e) => {
            const s = sources.find((s) => s.id === e.target.value);
            if (s)
              update({
                ...q,
                sources: [
                  ...q.sources,
                  {
                    alias: `source${q.sources.length + 1}`,
                    source: { kind: s.kind, id: s.id },
                  },
                ],
              });
          }}
        >
          <option value="">Choose table or saved query</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kind}: {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="qd-canvas" aria-label="Query canvas">
        {q.sources.map((s, i) => {
          const p = positions[`${q.id}:${i}`] ?? {
            x: 20 + i * 230,
            y: 25,
          };
          return (
            <article
              key={i}
              className="qd-node"
              style={{ left: p.x, top: p.y }}
              draggable
              onDragEnd={(e) => {
                const r =
                  e.currentTarget.parentElement!.getBoundingClientRect();
                setPositions((ps) => ({
                  ...ps,
                  [`${q.id}:${i}`]: {
                    x: Math.max(0, e.clientX - r.left - 80),
                    y: Math.max(0, e.clientY - r.top - 20),
                  },
                }));
              }}
            >
              <strong>{s.alias}</strong>
              <span>
                {sources.find((x) => x.id === s.source.id)?.name ??
                  "Missing source"}
              </span>
              {fields(project, q)
                .filter((f) => f.alias === s.alias)
                .map((f) => (
                  <span key={f.id}>
                    {f.name} · {f.type.kind}
                  </span>
                ))}
              <label>
                Position x
                <input
                  type="number"
                  aria-label={`${s.alias} position x`}
                  value={p.x}
                  onChange={(e) =>
                    setPositions((ps) => ({
                      ...ps,
                      [`${q.id}:${i}`]: {
                        ...p,
                        x: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label>
                Position y
                <input
                  type="number"
                  aria-label={`${s.alias} position y`}
                  value={p.y}
                  onChange={(e) =>
                    setPositions((ps) => ({
                      ...ps,
                      [`${q.id}:${i}`]: {
                        ...p,
                        y: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
            </article>
          );
        })}
        <svg aria-hidden="true" width="1800" height="600">
          {q.joins.map((j, i) => {
            const l = q.sources.findIndex((s) => s.alias === j.leftAlias),
              r = q.sources.findIndex((s) => s.alias === j.rightAlias),
              a = positions[`${q.id}:${l}`] ?? {
                x: 20 + l * 230,
                y: 25,
              },
              b = positions[`${q.id}:${r}`] ?? {
                x: 20 + r * 230,
                y: 25,
              };
            return (
              <g key={i}>
                <line
                  x1={a.x + 190}
                  y1={a.y + 20}
                  x2={b.x}
                  y2={b.y + 20}
                  stroke="#55718a"
                  strokeWidth="2"
                />
                <text x={(a.x + b.x + 190) / 2} y={(a.y + b.y) / 2 + 15}>
                  {j.kind}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p>
        Canvas positions are view preferences. Edit all join keys below; combine
        ordered composite key pairs with “and”.
      </p>
      {q.sources.map((s, i) => (
        <fieldset key={i}>
          <legend>Source {i + 1}</legend>
          <label>
            Alias
            <input
              aria-label={`Source ${i + 1} alias`}
              value={s.alias}
              onChange={(e) => update(renameAlias(q, i, e.target.value))}
            />
          </label>
          <button
            onClick={() =>
              update({
                ...q,
                sources: q.sources.filter((_, n) => n !== i),
              })
            }
          >
            Remove source {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        disabled={q.sources.length < 2}
        onClick={() =>
          update({
            ...q,
            joins: [
              ...q.joins,
              {
                leftAlias: q.sources[0]!.alias,
                rightAlias: q.sources[1]!.alias,
                kind: "left",
                cardinality: "one-to-many",
                on: literal(),
              },
            ],
          })
        }
      >
        Add join
      </button>
      {q.joins.map((j, i) => (
        <fieldset key={i} id={`query-join-${i}`}>
          <legend>Join {i + 1}</legend>
          {(["leftAlias", "rightAlias"] as const).map((k) => (
            <label key={k}>
              {k}
              <select
                aria-label={`Join ${i + 1} ${k}`}
                value={j[k]}
                onChange={(e) =>
                  update({
                    ...q,
                    joins: q.joins.map((x, n) =>
                      n === i ? { ...x, [k]: e.target.value } : x,
                    ),
                  })
                }
              >
                {q.sources.map((s) => (
                  <option key={s.alias}>{s.alias}</option>
                ))}
              </select>
            </label>
          ))}
          <select
            aria-label={`Join ${i + 1} kind`}
            value={j.kind}
            onChange={(e) =>
              update({
                ...q,
                joins: q.joins.map((x, n) =>
                  n === i
                    ? {
                        ...x,
                        kind: e.target.value as typeof j.kind,
                      }
                    : x,
                ),
              })
            }
          >
            <option value="left">Left outer</option>
            <option value="inner">Inner</option>
          </select>
          <select
            aria-label={`Join ${i + 1} cardinality`}
            value={j.cardinality}
            onChange={(e) =>
              update({
                ...q,
                joins: q.joins.map((x, n) =>
                  n === i
                    ? {
                        ...x,
                        cardinality: e.target.value as typeof j.cardinality,
                      }
                    : x,
                ),
              })
            }
          >
            {["one-to-one", "one-to-many", "many-to-one", "many-to-many"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
          {expression(
            j.on,
            (on) =>
              update({
                ...q,
                joins: q.joins.map((x, n) => (n === i ? { ...x, on } : x)),
              }),
            `Join ${i + 1} condition`,
          )}
          <button
            onClick={() =>
              update({
                ...q,
                joins: q.joins.filter((_, n) => n !== i),
              })
            }
          >
            Remove join
          </button>
        </fieldset>
      ))}
    </>
  );
}
