import type Database from 'better-sqlite3';
import { isLiteralValue } from '@schema-baron/model';
import { existsSync } from 'node:fs';
const supportUrl = new URL('./support.js', import.meta.url);
const { QueryError, quoteIdentifier } = await import(existsSync(supportUrl) ? supportUrl.href : new URL('./support.ts', import.meta.url).href) as typeof import('./support.js');
import type { CompiledQuery, QueryCostOptions, QueryPreviewResult } from './index.js';
const decimalUrl = new URL('../decimal/index.js', import.meta.url);
const { decimalCodec, registerDecimalFunctions } = await import(existsSync(decimalUrl) ? decimalUrl.href : new URL('../decimal/index.ts', import.meta.url).href) as typeof import('../decimal/index.js');
/** Internal worker entry point. Only execute compiler-produced SELECT statements on a query-only connection. */
export function executeQueryPreview(db: Database.Database, compiled: CompiledQuery, options: QueryCostOptions = {}): QueryPreviewResult {
 if(db.pragma('query_only',{simple:true})!==1 || !compiled.sql.startsWith('SELECT ') || !Number.isInteger(compiled.rowLimit) || compiled.rowLimit<1 || compiled.rowLimit>200)throw new QueryError('ACCESS_DENIED','Preview requires a query-only connection and a bounded compiled SELECT.');
 registerDecimalFunctions(db);
 const max=options.maxScannedRows??100000;if(!Number.isSafeInteger(max)||max<1||max>100000)throw new QueryError('INVALID_INPUT','Invalid preview cost budget.');
 let scanned=0;
 for(const t of compiled.tables) {
  const columns=db.prepare('SELECT name, pk, "notnull", type FROM pragma_table_xinfo(?)').all(t.name) as {name:string;pk:number;notnull:number;type:string}[];
  if(t.columns.some(name=>!columns.some(c=>c.name===name)))throw new QueryError('DATABASE_CHANGED','Query columns changed. Reinspect the connection.');
  const observed: string[][]=[];
  const pk=columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk);
  if(pk.length && pk.every(c=>c.notnull || pk.length===1 && c.type.toUpperCase()==='INTEGER'))observed.push(pk.map(c=>c.name));
  const indexes=db.prepare('SELECT name, "unique", partial FROM pragma_index_list(?)').all(t.name) as {name:string;unique:number;partial:number}[];
  for(const i of indexes.filter(i=>i.unique && !i.partial)) {
   const keys=db.prepare('SELECT name, cid, coll, "desc", key FROM pragma_index_xinfo(?)').all(i.name) as {name:string;cid:number;coll:string;desc:number;key:number}[];
   const used=keys.filter(k=>k.key);if(used.length && used.every(k=>k.cid>=0 && k.coll==='BINARY'))observed.push(used.map(k=>k.name));
  }
  if(t.uniqueKeys.some(k=>!observed.some(o=>k.length===o.length && k.every((v,i)=>v===o[i]))))throw new QueryError('DATABASE_CHANGED','Declared unique keys are not present in SQLite. Reinspect before relying on aggregate grain.');
  const count=db.prepare(`SELECT count(*) AS n FROM (SELECT 1 FROM ${quoteIdentifier(t.name)} LIMIT ?)`).get(max+1) as {n:number};scanned+=count.n;
  if(scanned>max)throw new QueryError('QUERY_COST_EXCEEDED','Preview scan budget exceeded. Filter or preaggregate a smaller source before previewing.');
 }
 // A physical unique index does not prove uniqueness after logical normalization
 // or SQLite affinity/collation. Prove the actual join relation in this same read
 // transaction, before the result LIMIT can hide a counterexample. Worker cost and
 // cancellation/deadline bounds include these statements.
 for(const check of compiled.grainChecks)if(db.prepare(check).get(compiled.parameters))throw new QueryError('INVALID_QUERY_GRAIN','Join comparison matches multiple rows despite its declared unique grain. Group the child query by the logical key or correct the source encoding and cardinality.');
 // Prepare both explanation and execution with exactly the same bound parameters.
 db.prepare('EXPLAIN QUERY PLAN '+compiled.sql).all(compiled.parameters);
 const statement=db.prepare(compiled.sql);if(!statement.readonly)throw new QueryError('ACCESS_DENIED','Preview cannot mutate SQLite.');
 const rows=statement.safeIntegers(true).all(compiled.parameters) as Record<string,unknown>[];
 const decoded=rows.slice(0,compiled.rowLimit).map(row=>Object.fromEntries(compiled.fields.map(f=>{
  let v=row[f.id]; if(v!==null) {
   if(f.type.kind==='decimal')v=decimalCodec(v,{...f.type,encoding:'text'});
   else if(typeof v==='bigint'){const n=Number(v);if(!Number.isSafeInteger(n))throw new QueryError('TYPE_MISMATCH','Integer result exceeds the transport safe integer range.');v=n;}
   if(f.type.kind==='boolean' && (v===0||v===1))v=Boolean(v);
   if(f.type.kind==='blob' && v instanceof Uint8Array)v=Buffer.from(v).toString('base64');
  }
  if(!isLiteralValue(v,f.type,f.nullable))throw new QueryError('TYPE_MISMATCH','SQLite result does not match its declared type or nullability. Check source data and expressions.');
  return [f.id,v as string|number|boolean|null];
 })));
 return {fields:compiled.fields,rows:decoded,sql:compiled.sql,truncated:rows.length>compiled.rowLimit};
}
