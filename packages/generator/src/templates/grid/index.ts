import type { GridIR } from '../../ir/index.js';
const literal = (value: unknown) => JSON.stringify(value);
export function gridFiles(grid: GridIR, index: number) {
 const fields = grid.source.fields.filter(f => grid.controls.some(c => c.fieldId === f.id) || grid.source.keys.includes(f.id) || grid.search.some(s => s.fieldId === f.id) || grid.sorting.some(s => s.fieldId === f.id));
 const config = { table: grid.source.name, fields, search: grid.search, sorting: grid.sorting, pageSize: grid.pageSize };
 const prefix = grid.id;
 const parameter = (key: string) => literal(`${prefix}:${key}`);
 const controls = grid.controls.map(c => `<td>{${c.fieldId ? `formatValue(row[${literal(c.fieldId)}], ${literal(grid.source.fields.find(f => f.id === c.fieldId)?.type)}, ${literal(c.format)})` : literal(c.label)}}</td>`).join('\n                  ');
 const rowKey = grid.source.keys.length ? `JSON.stringify([${grid.source.keys.map(k => `row[${literal(k)}]`).join(', ')}].map(value => String(value)))` : 'rowIndex';
 return [
  { path: `server/grid-${index}.ts`, content: `import 'server-only';
import { readGrid } from './repository';

// This repository's identifiers come from the validated project, never a request.
const config = ${JSON.stringify(config, null, 2)} as const;

export function loadGrid(parameters: Record<string, string | string[] | undefined>) {
  return readGrid(config, parameters, ${literal(prefix)});
}
` },
  { path: `components/grid-${index}.tsx`, content: `import { loadGrid } from '../server/grid-${index}';
import { formatValue } from '../server/format';

type Parameters = Record<string, string | string[] | undefined>;

export function Grid${index}({ parameters }: { parameters: Parameters }) {
  const { rows, page, error } = loadGrid(parameters);

  if (error) {
    return <section><h2>{${literal(grid.label)}}</h2><p role="alert">{error}</p></section>;
  }

  return (
    <section>
      <h2>{${literal(grid.label)}}</h2>
      <form method="get">
${grid.search.map(s => `        <label>
          {${literal(grid.controls.find(c => c.fieldId === s.fieldId)?.label ?? s.fieldId)}}
          <input
            name={${parameter('filter:' + s.fieldId)}}
            defaultValue={typeof parameters[${parameter('filter:' + s.fieldId)}] === 'string' ? parameters[${parameter('filter:' + s.fieldId)}] : ''}
          />
        </label>`).join('\n')}
        <label>
          Sort
          <select name={${parameter('sort')}} defaultValue={typeof parameters[${parameter('sort')}] === 'string' ? parameters[${parameter('sort')}] : ''}>
            <option value="">Default order</option>
${fields.map(f => `            <option value={${literal(f.id)}}>{${literal(f.name)}}</option>`).join('\n')}
          </select>
        </label>
        <label>
          Direction
          <select name={${parameter('direction')}} defaultValue={parameters[${parameter('direction')}] === 'desc' ? 'desc' : 'asc'}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <button>Filter and sort</button>
      </form>
      {rows.length === 0 ? (
        <p>No records found.</p>
      ) : (
        <table>
          <thead>
            <tr>
${grid.controls.map(c => `              <th>{${literal(c.label)}}</th>`).join('\n')}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={${rowKey}}>
                ${controls}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form method="get">
        {Object.entries(parameters)
          .filter(([key]) => key !== ${parameter('page')})
          .flatMap(([key, value]) => typeof value === 'string'
            ? [<input key={key} type="hidden" name={key} value={value} />]
            : [])}
        <button name={${parameter('page')}} value={Math.max(1, page - 1)} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button name={${parameter('page')}} value={page + 1} disabled={rows.length < ${grid.pageSize}}>
          Next
        </button>
      </form>
    </section>
  );
}
` }
 ];
}
