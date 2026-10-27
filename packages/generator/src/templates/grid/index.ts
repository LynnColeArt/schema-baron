import type { GridIR } from '../../ir/index.js';
const literal = (value: unknown) => JSON.stringify(value);
export function gridFiles(grid: GridIR, index: number) {
 const fields = grid.source.fields;
 const sortFieldIds=[...new Set([...grid.controls.flatMap(c=>c.fieldId?[c.fieldId]:[]),...grid.sorting.map(s=>s.fieldId)])];
 const config = { sortFieldIds, table: grid.source.name, fields, keys: grid.source.keys, search: grid.search, sorting: grid.sorting, pageSize: grid.pageSize, parents:grid.keyMapping.filter(k=>k.expression.kind==='parameter').map(k=>({fieldId:k.targetFieldId,parameter:k.expression.kind==='parameter'?k.expression.parameterId:grid.id+':key:'+k.targetFieldId})) };
 const prefix = grid.id;
 const parameter = (key: string) => literal(`${prefix}:${key}`);
 const links=(grid.actions??[]).filter(a=>a.operation==='navigate');
 const controls = grid.controls.map(c => c.kind==='link'?`<td>${(c.events??[]).map(e=>links.find(a=>a.id===e.actionId)).filter(Boolean).map(a=>`<a href={link(${literal(a!.id)}, row, parameters)}>{${literal(c.label)}}</a>`).join('')}</td>`:`<td>{${c.fieldId ? `formatValue(row[${literal(c.fieldId)}], ${literal(grid.source.fields.find(f => f.id === c.fieldId)?.type)}, ${literal(c.format)})` : literal(c.label)}}</td>`).join('\n                  ');
 const rowKey = grid.source.keys.length ? `JSON.stringify([${grid.source.keys.map(k => `row[${literal(k)}]`).join(', ')}].map(value => String(value)))` : 'rowIndex';
 return [
  { path: `server/grid-${index}.ts`, content: `import 'server-only';
import { readGrid } from './repository.ts';
import { destination, type Destination, type ContextField } from './navigation.ts';
import type { Parameters } from './record-validation';

// This repository's identifiers come from the validated project, never a request.
const config = ${JSON.stringify(config, null, 2)} as const;
const actions = ${JSON.stringify(links.map(action=>({id:action.id,destination:action.destination})))} as readonly {id:string;destination:Destination}[];
const allowed = ${JSON.stringify(grid.context??[])} as readonly ContextField[];
export function link(id:string,row:Record<string,unknown>,parameters:Parameters) {
 const action=actions.find(a=>a.id===id); if(!action) return '#';
 try{return destination(action.destination,row,parameters,allowed);}catch{return '#';}
}

export function loadGrid(parameters: Record<string, string | string[] | undefined>) {
  return readGrid(config, parameters, ${literal(prefix)});
}
` },
  { path: `components/grid-${index}.tsx`, content: `import { loadGrid, link } from '../server/grid-${index}';
import { formatValue } from '../server/format';
import { context } from '../server/navigation';
const allowed = ${JSON.stringify(grid.context??[])} as const;

type Parameters = Record<string, string | string[] | undefined>;

export function Grid${index}({ parameters }: { parameters: Parameters }) {
  const { rows, page, error } = loadGrid(parameters);
  let retained:Record<string,string>={};
  try {retained=context(parameters,allowed);}catch{}

  if (error) {
    return <section><h2>{${literal(grid.label)}}</h2><p role="alert">{error}</p></section>;
  }

  return (
    <section>
      <h2>{${literal(grid.label)}}</h2>
      ${links.filter(a=>(a.destination as {newForms?:string[]})?.newForms?.length).map(a=>`<a href={link(${literal(a.id)}, {}, parameters)}>New record</a>`).join('\n')}
      <form method="get">
        {Object.entries(retained).filter(([key])=>!key.startsWith(${literal(grid.id+':')})).map(([key,value])=><input key={key} type="hidden" name={key} value={value} />)}
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
${fields.filter(f=>sortFieldIds.includes(f.id)).map(f => `            <option value={${literal(f.id)}}>{${literal(f.name)}}</option>`).join('\n')}
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
        {Object.entries(retained)
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
