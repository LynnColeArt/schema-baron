import {handlerPath} from '../../behavior/index.js';
import { keyParameter } from '../navigation/index.js';
import type { GridIR } from '../../ir/index.js';
const literal = (value: unknown) => JSON.stringify(value);
export function gridFiles(grid: GridIR, index: number) {
 const fields = grid.source.fields;
 const sortFieldIds=[...new Set([...grid.controls.flatMap(c=>c.fieldId?[c.fieldId]:[]),...grid.sorting.map(s=>s.fieldId)])];
 const config = { sortFieldIds, table: grid.source.name, fields, keys: grid.source.keys, search: grid.search, sorting: grid.sorting, pageSize: grid.pageSize, parents:grid.keyMapping.map(k=>({fieldId:k.targetFieldId,parameter:keyParameter(grid,k.targetFieldId)})) };
 const prefix = grid.id;
 const parameter = (key: string) => literal(`${prefix}:${key}`);
 const links=(grid.actions??[]).filter(a=>a.operation==='navigate');
 const controls = grid.controls.map(c => c.kind==='link'?`<td>${(c.events??[]).map(e=>links.find(a=>a.id===e.actionId)).filter(Boolean).map(a=>`<NavigationLink actionId={${literal(a!.id)}} row={row} parameters={parameters}>{${literal(c.label)}}</NavigationLink>`).join('')}</td>`:`<td>{${c.fieldId ? `formatValue(row[${literal(c.fieldId)}], ${literal(grid.source.fields.find(f => f.id === c.fieldId)?.type)}, ${literal(c.format)})` : literal(c.label)}}</td>`).join('\n                  ');
 const rowKey = grid.source.keys.length ? `JSON.stringify([${grid.source.keys.map(k => `row[${literal(k)}]`).join(', ')}].map(value => String(value)))` : 'rowIndex';
 return [
  {path:`app${handlerPath('navigation',index)}/route.ts`,content:`import {cookies} from 'next/headers';
import {authorize,sessionCookie,failure} from '../../../server/auth';
import {config,actions} from '../../../server/grid-${index}';
import {connect,read} from '../../../server/record-repository';
import {value} from '../../../server/record-validation';
import {context,destination,type ContextField} from '../../../server/navigation';
const allowed=${JSON.stringify(grid.context??[])} as readonly ContextField[];
export async function GET(request:Request){let db:ReturnType<typeof connect>|undefined;try{
 const url=new URL(request.url),id=url.searchParams.get('_action')??'';
 authorize(${JSON.stringify(grid.pageId??'')},id,(await cookies()).get(sessionCookie)?.value);
 const action=actions.find(a=>a.id===id);if(!action)throw Error();
 const parameters:Record<string,string>={};for(const [key,text] of url.searchParams){if(url.searchParams.getAll(key).length!==1)throw Error();if(key==='_action'||config.keys.some((_,i)=>key==='_key:'+i))continue;if(!allowed.some(c=>c.parameter===key))throw Error();parameters[key]=text;}
 context(parameters,allowed);let row:Record<string,unknown>={};
 if(!action.destination.newForms.length){const keys=config.keys.map((key,i)=>{const text=url.searchParams.get('_key:'+i);if(text===null)throw Error();return value(config.fields.find(f=>f.id===key)!,text);});db=connect();row=read(db,{...config,keys:config.keys},keys)??{};if(!Object.keys(row).length)throw Error();}
 return Response.redirect(new URL(destination(action.destination,row,parameters,allowed),request.url),303);
 }catch(error){return failure(error);}finally{db?.close();}}
`},
  { path: `server/grid-${index}.ts`, content: `import 'server-only';
import { readGrid } from './repository.ts';
import { entered } from './record-validation.ts';
import { destination, context, type Destination, type ContextField } from './navigation.ts';
import type { Parameters } from './record-validation';

// This repository's identifiers come from the validated project, never a request.
export const config = ${JSON.stringify(config, null, 2)} as const;
export const actions = ${JSON.stringify(links.map(action=>({id:action.id,access:action.access??'public',destination:action.destination})))} as readonly {id:string;access:string;destination:Destination}[];
const allowed = ${JSON.stringify(grid.context??[])} as readonly ContextField[];
export function link(id:string,row:Record<string,unknown>,parameters:Parameters):{href?:string;error?:string} {
 const action=actions.find(a=>a.id===id);
 if(!action) return {error:'This navigation action is unavailable.'};
 try{
  if(action.access==='authenticated'){const query=new URLSearchParams(context(parameters,allowed));query.set('_action',action.id);if(!action.destination.newForms.length)for(const [i,key] of config.keys.entries()){const field=config.fields.find(f=>f.id===key)!;query.set('_key:'+i,entered(field,row[key]));}return {href:'${handlerPath('navigation',index)}?'+query};}
  return {href:destination(action.destination,row,parameters,allowed)};}
 catch{return {error:'This link could not be created. Check the page filters and mapped record values.'};}
}

export function loadGrid(parameters: Record<string, string | string[] | undefined>) {
  return readGrid(config, parameters, ${literal(prefix)});
}
` },
  { path: `components/grid-${index}.tsx`, content: `import type { ReactNode } from 'react';
import { loadGrid, link } from '../server/grid-${index}';
import { formatValue } from '../server/format';
import { context } from '../server/navigation';
const allowed = ${JSON.stringify(grid.context??[])} as const;

type Parameters = Record<string, string | string[] | undefined>;
const parentParameters = ${JSON.stringify(grid.keyMapping.map(k=>keyParameter(grid,k.targetFieldId)))} as readonly string[];
function NavigationLink({actionId,row,parameters,children}:{actionId:string;row:Record<string,unknown>;parameters:Parameters;children:ReactNode}) {
 const result=link(actionId,row,parameters);
 return result.error?<span role="alert">{result.error}</span>:<a href={result.href}>{children}</a>;
}

export function Grid${index}({ parameters }: { parameters: Parameters }) {
  const { rows, page, error } = loadGrid(parameters);
  let retained:Record<string,string>={};
  let contextError:string|undefined;
  try {retained=context(parameters,allowed);}catch{contextError='The page filters or parent keys are invalid. Check the supplied values.';}

  if (error || contextError) {
    return <section><h2>{${literal(grid.label)}}</h2><p role="alert">{error ?? contextError}</p></section>;
  }

  return (
    <section>
      <h2>{${literal(grid.label)}}</h2>
      ${links.filter(a=>(a.destination as {newForms?:string[]})?.newForms?.length).map(a=>`<NavigationLink actionId={${literal(a.id)}} row={{}} parameters={parameters}>New record</NavigationLink>`).join('\n')}
      <form method="get">
        {Object.entries(retained).filter(([key])=>!key.startsWith(${literal(grid.id+':')})||parentParameters.includes(key)).map(([key,value])=><input key={key} type="hidden" name={key} value={value} />)}
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
