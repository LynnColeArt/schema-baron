import { isLiteralValue, parseProject, querySchema } from '@schema-baron/model';
import type { Expression, Project, Query, ScalarType, Table } from '@schema-baron/model';
import { decimalCodec } from '../decimal/index.js';
import { QueryError, quoteIdentifier } from './support.js';
export { QueryError, quoteIdentifier } from './support.js';
export type BoundValue = string | number | Uint8Array | null;
export interface CompiledQuery {
 sql: string; parameters: Record<string, BoundValue>; fields: Omit<Query['projections'][number], 'expression'>[]; rowLimit: number;
 /** Physical tables and key claims are checked against the actual read transaction before execution. */
 tables: { name: string; columns: string[]; uniqueKeys: string[][] }[];
}
export interface QueryPreviewResult { fields: CompiledQuery['fields']; rows: Record<string,string | number | boolean | null>[]; sql: string; truncated: boolean }
export interface QueryCostOptions { maxScannedRows?: number }
function boundedAst(input: unknown) {
 const stack: [unknown,number][]=[[input,0]]; let count=0;
 while(stack.length) { const [value,depth]=stack.pop()!; if(++count>20000 || depth>48) throw new QueryError('QUERY_COST_EXCEEDED','Query structure exceeds preview limits. Reduce expression depth or query size.'); if(value && typeof value==='object') for(const v of Object.values(value))stack.push([v,depth+1]); }
}
/** Validate the complete draft in the same canonical model as saved queries, then compile ID references only. */
export function compileQuery(project: Project, input: unknown, values: Record<string,unknown>, rowLimit = 200): CompiledQuery {
 boundedAst(input); if(!Number.isInteger(rowLimit) || rowLimit<1 || rowLimit>200)throw new QueryError('INVALID_INPUT','Preview row limit must be between 1 and 200.');
 const parsed=querySchema.safeParse(input); if(!parsed.success)throw new QueryError('UNSAFE_EXPRESSION','Unsupported query shape or expression. Use the supported AST grammar.');
 const draft=parsed.data;
 const validated=parseProject({...project,queries:[...project.queries.filter(q=>q.id!==draft.id),draft]});
 const root=validated.queries.find(q=>q.id===draft.id)!;
 const parameters: Record<string,BoundValue>={}; let binding=0; const declared=new Set<string>(); const tables=new Map<string,CompiledQuery['tables'][number]>();
 const bind=(v: unknown,t: ScalarType,nullable: boolean): string => {
  if(!isLiteralValue(v,t,nullable))throw new QueryError('TYPE_MISMATCH','A parameter or literal does not match its declared type, scale or nullability.');
  const value=v===null?null:t.kind==='decimal'?decimalCodec(v,{...t,encoding:'text'}):t.kind==='blob'?Buffer.from(v as string,'base64'):typeof v==='boolean'?Number(v):v as string|number;
  const name='v'+binding++; parameters[name]=value; return '@'+name;
 };
 const config=(t: Extract<ScalarType,{kind:'decimal'}>)=>`${t.precision},${t.scale},'${t.rounding}'`;
 const path=new Set<string>(); let queriesCompiled=0;
 function compile(q: Query): string {
  if(path.has(q.id))throw new QueryError('INVALID_QUERY_GRAIN','Cyclic query sources cannot be compiled.');
  if(path.size>12 || ++queriesCompiled>64 || q.sources.length>12)throw new QueryError('QUERY_COST_EXCEEDED','Query dependencies exceed bounded preview limits.'); path.add(q.id);
  if(new Set(q.sources.map(s=>s.alias.toLowerCase())).size!==q.sources.length)throw new QueryError('BROKEN_REFERENCE','Aliases must be unique under SQLite case folding.');
  const sources=new Map(q.sources.map(s=>[s.alias,s]));
  function tableFor(alias:string):Table|undefined {const s=sources.get(alias);return s?.source.kind==='table'?validated.schema.tables.find(t=>t.id===s.source.id):undefined;}
  function queryFor(alias:string):Query|undefined {const s=sources.get(alias);return s?.source.kind==='query'?validated.queries.find(t=>t.id===s.source.id):undefined;}
  function uniqueKeys(alias:string): string[][] {const t=tableFor(alias),child=queryFor(alias);return t?[t.primaryKey,...t.uniqueConstraints.map(u=>u.columnIds),...t.indexes.filter(i=>i.unique && !i.where).map(i=>i.columnIds)].filter(k=>k.length):child && child.grain.strategy!=='rows'?[child.grain.keys]:[];}
  function field(e: Extract<Expression,{kind:'field'}>) {
   const t=tableFor(e.alias),child=queryFor(e.alias);const column=t?.columns.find(c=>c.id===e.fieldId)??child?.projections.find(c=>c.id===e.fieldId);
   if(!column)throw new QueryError('BROKEN_REFERENCE','Field ID or source alias does not resolve.');
   return {sql:quoteIdentifier(e.alias)+'.'+quoteIdentifier('physicalName' in column?column.physicalName:column.id),type:column.type,physical:!!t};
  }
  // Prove right-side uniqueness from equality conjunctions and declared schema keys.
  // The worker rechecks the physical key claims, so a client cannot forge cardinality.
  let expansions=0;
  for(const j of q.joins) {
   const equalities: Extract<Expression,{kind:'binary'}>[]=[];
   function collect(e:Expression) {if(e.kind==='binary' && e.operator==='and'){collect(e.left);collect(e.right);}else if(e.kind==='binary' && e.operator==='=')equalities.push(e);}
   collect(j.on);
   function joinedKeys(alias:string,otherAlias:string): Set<string> {const keys=new Set<string>();for(const e of equalities)if(e.left.kind==='field' && e.right.kind==='field'){if(e.left.alias===alias && e.right.alias===otherAlias)keys.add(e.left.fieldId);if(e.right.alias===alias && e.left.alias===otherAlias)keys.add(e.right.fieldId);}return keys;}
   const right=joinedKeys(j.rightAlias,j.leftAlias),left=joinedKeys(j.leftAlias,j.rightAlias);
   const isUnique=(alias:string,keys:Set<string>)=>uniqueKeys(alias).some(k=>k.every(id=>keys.has(id)));
   const rightUnique=isUnique(j.rightAlias,right),leftUnique=isUnique(j.leftAlias,left);
   if((['many-to-one','one-to-one'].includes(j.cardinality) && !rightUnique) || (['one-to-many','one-to-one'].includes(j.cardinality) && !leftUnique))throw new QueryError('INVALID_QUERY_GRAIN','Join cardinality requires equality on a complete unique key, including composite grain keys.');
   if(!rightUnique)expansions++;
  }
  if(q.grain.strategy!=='rows' && expansions>1)throw new QueryError('INVALID_QUERY_GRAIN','Multiple expanding child joins require grouped child queries joined on their complete grain keys.');
  const localParameters=new Map(q.parameters.map(p=>{declared.add(p.id);const value=Object.hasOwn(values,p.id)?values[p.id]:p.default;return[p.id,{sql:bind(value,p.type,p.nullable),type:p.type}];}));
  type Node={sql:string;type:ScalarType};
  function expression(e:Expression):Node {
   if(e.kind==='literal')return {sql:bind(e.value,e.type,true),type:e.type};
   if(e.kind==='parameter'){const p=localParameters.get(e.parameterId);if(!p)throw new QueryError('BROKEN_REFERENCE','Unknown parameter ID.');return p;}
   if(e.kind==='field'){const f=field(e);return {...f,sql:f.type.kind==='decimal' && f.physical?`sb_decimal(${f.sql},${config(f.type)},'${f.type.encoding}')`:f.sql};}
   if(e.kind==='binary') {
    const a=expression(e.left),b=expression(e.right);const arithmetic=['+','-','*','/'].includes(e.operator);
    if(a.type.kind==='decimal') {
     const cfg=config(a.type);const operation={'+':'add','-':'subtract','*':'multiply','/':'divide'} as const;
     return arithmetic?{sql:`sb_${operation[e.operator as keyof typeof operation]}(${a.sql},${b.sql},${cfg})`,type:a.type}:{sql:`(sb_compare(${a.sql},${b.sql},${cfg}) ${e.operator} 0)`,type:{kind:'boolean'}};
    }
    return {sql:`(${a.sql} ${e.operator.toUpperCase()} ${b.sql})`,type:arithmetic?a.type:{kind:'boolean'}};
   }
   if(e.kind==='aggregate') {
    const a=e.argument?expression(e.argument):undefined;const type:ScalarType=e.function==='count'?{kind:'integer'}:e.function==='avg' && a!.type.kind!=='decimal'?{kind:'real'}:a!.type;
    let sql=a?.type.kind==='decimal' && e.function!=='count'?`sb_${e.function}(${e.distinct?'DISTINCT ':''}${a.sql},${config(a.type)})`:`${e.function.toUpperCase()}(${e.distinct?'DISTINCT ':''}${a?.sql??'*'})`;
    if(a?.type.kind==='decimal' && e.distinct && e.function!=='count')throw new QueryError('UNSAFE_EXPRESSION','DISTINCT exact aggregates require a grouped child query; SQLite aggregate DISTINCT accepts one argument.');
    if(e.zeroChildren==='zero' && e.function!=='count')sql=`COALESCE(${sql},${bind(type.kind==='decimal'?'0':0,type,false)})`;
    return {sql,type};
   }
   const args=e.args.map(expression),a=args[0]!;
   if(e.function==='abs' && a.type.kind==='decimal')return {sql:`sb_abs(${a.sql},${config(a.type)})`,type:a.type};
   if(e.function==='year')return {sql:`CAST(strftime('%Y',${a.sql}) AS INTEGER)`,type:{kind:'integer'}};
   return {sql:`${e.function.toUpperCase()}(${args.map(a=>a.sql).join(',')})`,type:e.function==='length'?{kind:'integer'}:e.function==='date'?{kind:'date',encoding:'iso-date'}:a.type};
  }
  function source(alias:string):string {
   const t=tableFor(alias);if(t){
    const keys=uniqueKeys(alias); tables.set(t.id,{name:t.physicalName,columns:t.columns.map(c=>c.physicalName),uniqueKeys:keys.map(k=>k.map(id=>t.columns.find(c=>c.id===id)!.physicalName))});
    return quoteIdentifier(t.physicalName)+' AS '+quoteIdentifier(alias);
   }
   const child=queryFor(alias);if(!child)throw new QueryError('BROKEN_REFERENCE','Query source does not resolve.');
   return '('+compile(child)+') AS '+quoteIdentifier(alias);
  }
  const select=q.projections.map(p=>expression(p.expression).sql+' AS '+quoteIdentifier(p.id));
  let sql='SELECT '+select.join(',')+' FROM '+source(q.sources[0]!.alias);
  for(const join of q.joins)sql+=` ${join.kind==='left'?'LEFT':'INNER'} JOIN ${source(join.rightAlias)} ON ${expression(join.on).sql}`;
  if(q.where)sql+=' WHERE '+expression(q.where).sql;
  if(q.groupBy.length)sql+=' GROUP BY '+q.groupBy.map(g=>expression(g).sql).join(',');
  if(q.having)sql+=' HAVING '+expression(q.having).sql;
  if(q.orderBy.length)sql+=' ORDER BY '+q.orderBy.map(o=>{const n=expression(o.expression);return (n.type.kind==='decimal'?`sb_sort(${n.sql},${config(n.type)})`:n.sql)+' '+o.direction.toUpperCase();}).join(',');
  path.delete(q.id);return sql;
 }
 const sql=compile(root);if(Object.keys(values).some(id=>!declared.has(id)))throw new QueryError('INVALID_INPUT','Unknown parameter ID. Parameters use stable IDs, including child-query parameters.');
 return {sql:sql+' LIMIT '+bind(rowLimit+1,{kind:'integer'},false),parameters,fields:root.projections.map(({expression:_,...field})=>field),rowLimit,tables:[...tables.values()]};
}
