import {gridFiles} from '../grid/index.js';
import type {GridIR,QueryIR} from '../../ir/index.js';
const literal=JSON.stringify;
/** A query report uses ordinary Grid controls, formatting and declared row links. */
export function reportFiles(grid:GridIR,index:number,queries:QueryIR[]){
 const sourcePlan=queries.find(q=>q.id===grid.report!.queryId)!;
 const limit=sourcePlan.compiled.sql.match(/ LIMIT @(v\d+)$/)?.[1];if(!limit)throw Error('Compiled report limit is unavailable.');
 const plan={...sourcePlan,compiled:{...sourcePlan.compiled,sql:sourcePlan.compiled.sql+' OFFSET @sb_report_offset',rowLimit:grid.pageSize,parameters:{...sourcePlan.compiled.parameters,[limit]:grid.pageSize+1}}};
 const files=gridFiles(grid,index).filter(file=>!file.path.startsWith('app/runtime/navigation-'));
 const server=files[0]!;
 server.path=`server/report-${index}.ts`;
 server.content=server.content.replace("import { readGrid } from './repository.ts';", "import {readReport} from './query-runtime';");
 const start=server.content.indexOf('export function loadGrid(');
 server.content=server.content.slice(0,start)+`export async function loadGrid(parameters: Parameters) {return readReport(${literal(plan)},${literal(grid.report!.parameters??[])},parameters,${literal(grid.id)});}\n`;
 const component=files[1]!;
 component.content=component.content.replace(`../server/grid-${index}`,`../server/report-${index}`).replace(`export function Grid${index}`,`export async function Grid${index}`).replace('= loadGrid(parameters);','= await loadGrid(parameters);');
 for(const control of grid.controls.filter(c=>c.kind==='link'&&c.fieldId))component.content=component.content.replaceAll('>{'+literal(control.label)+'}</NavigationLink>','>{formatValue(row['+literal(control.fieldId)+'],'+literal(grid.source.fields.find(f=>f.id===control.fieldId)!.type)+','+literal(control.format)+')}</NavigationLink>');
 const formStart=component.content.indexOf('      <form method="get">'),formEnd=component.content.indexOf('      </form>',formStart)+13;
 const runtime=(grid.report!.parameters??[]).filter(m=>m.runtime).map(mapping=>{const p=plan.inputs.find(p=>p.id===mapping.parameterId)!;const key=grid.id+':parameter:'+mapping.runtime!.name;
 return `<label>{${literal(p.name)}}<input name={${literal(key)}} defaultValue={typeof parameters[${literal(key)}]==='string'?parameters[${literal(key)}]:''} /></label><label>Input mode<select name={${literal(key+':mode')}} defaultValue={typeof parameters[${literal(key+':mode')}]==='string'?parameters[${literal(key+':mode')}]:parameters[${literal(key)}]===undefined?'default':'value'}><option value="default">Default</option><option value="value">Value</option>${p.nullable?'<option value="null">Null</option>':''}</select></label>`;}).join('\n');
 component.content=component.content.slice(0,formStart)+`      <form method="get">{Object.entries(retained).filter(([key])=>!key.startsWith(${literal(grid.id+':')})).map(([key,value])=><input key={key} type="hidden" name={key} value={value} />)}${runtime}<button>Apply parameters</button></form>`+component.content.slice(formEnd);
 return files;
}
