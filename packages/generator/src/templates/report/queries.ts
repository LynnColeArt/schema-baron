import {queryInputs} from '@schema-baron/model';
import { compileQuery,QueryError } from '@schema-baron/sqlite';
import type { Project } from '@schema-baron/model';
import type {Diagnostic} from '@schema-baron/model';
import type { QueryIR } from '../../ir/index.js';
export class QueryCompilationError extends Error {constructor(readonly diagnostics:Diagnostic[]){super(diagnostics[0]?.message??'Query compilation failed.');}}
/** The generator compiles syntax once. Only these declared bound slots vary at runtime. */
export function compileQueries(project:Project):QueryIR[] {
 return project.queries.map(query=>{
  const inputs=queryInputs(project,query.id);
  const values=Object.fromEntries(inputs.map(p=>[p.id,p.default!==undefined?p.default:p.nullable?null:p.type.kind==='boolean'?false:['integer','real'].includes(p.type.kind)?0:p.type.kind==='date'?'2000-01-01':p.type.kind==='datetime'?'2000-01-01T00:00:00Z':p.type.kind==='decimal'?'0':'']));
  const bindings:Record<string,string[]>={};
  try{return {id:query.id,inputs,bindings,compiled:compileQuery(project,query,values,200,bindings)};}catch(error){if(error instanceof QueryError)throw new QueryCompilationError([{code:error.code,severity:'error',objectId:query.id,message:error.message,recoveryAction:'Repair this saved query before generating its report.'}]);throw error;}
 });
}
