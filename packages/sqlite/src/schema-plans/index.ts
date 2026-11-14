import type Database from 'better-sqlite3';
import type { PhysicalTable } from '../introspection/index.js';
import { Decimal } from 'decimal.js';
import { createHash } from 'node:crypto';
import { canonicalJson, createId, expressionSchema, isLiteralValue, schemaSchema } from '@schema-baron/model';
import type { Diagnostic, Expression, ReviewedPlan, Schema, Table } from '@schema-baron/model';
import { existsSync } from 'node:fs';
const introspectionUrl = new URL('../introspection/index.js', import.meta.url);
const { inspectDatabase } = await import(existsSync(introspectionUrl) ? introspectionUrl.href : new URL('../introspection/index.ts', import.meta.url).href) as typeof import('../introspection/index.js');
export interface SchemaChange { objectId: string; tableId: string; kind: 'rename' | 'add' | 'drop' | 'type' | 'key' | 'index' | 'foreign-key' | 'constraint'; description: string }
export interface SchemaPlanInput { baseline: Schema; desired: Schema; schemaFingerprint: string; backfills: { tableId: string; columnId: string; expression: Expression }[] }
type Migration = Extract<ReviewedPlan, { kind: 'migration' }>;
export interface SchemaPlanResult { diagnostics: Diagnostic[]; changes: SchemaChange[]; steps: Migration['steps']; impact: Migration['impact']; schemaFingerprint: string; dataFingerprint: string; sqliteVersion: string; strategy: 'native' | 'rebuild' }
class PlanningError extends Error { readonly diagnostic: Diagnostic; constructor(diagnostic: Diagnostic) { super(diagnostic.message); this.diagnostic = diagnostic; } }
function fail(code: Diagnostic['code'], objectId: string, message: string): never { throw new PlanningError({code,severity:'error',objectId:createId(()=>objectId),message,recoveryAction:'Repair the candidate or inspect the database again, then create a new preview.'}); }
function quote(value: string) { if (value.includes('\0')) throw new PlanningError({code:'INVALID_INPUT',severity:'error',message:'Identifiers cannot contain NUL.'}); return '"'+value.replaceAll('"','""')+'"'; }
const equal = (a: unknown,b: unknown) => canonicalJson(a) === canonicalJson(b);
function hasDecimal(node:Expression,table:Table):boolean { if(node.kind==='literal') return node.type.kind==='decimal'; if(node.kind==='field') return table.columns.find(c=>c.id===node.fieldId)?.type.kind==='decimal'; if(node.kind==='binary') return hasDecimal(node.left,table)||hasDecimal(node.right,table); if(node.kind==='function') return node.args.some(a=>hasDecimal(a,table)); return false; }
function expression(node: Expression, table: Table, mode: 'default'|'check'|'copy'): string {
 expressionSchema.parse(node);
 switch (node.kind) {
 case 'literal': if(!isLiteralValue(node.value,node.type,true)) fail('TYPE_MISMATCH',table.id,'Literal value does not match its declared logical type.'); if(node.type.kind==='decimal' && node.type.encoding==='scaled-integer' && node.value!==null) return new Decimal(String(node.value)).mul(new Decimal(10).pow(node.type.scale)).toFixed(0); if(node.type.kind==='blob' && node.value!==null) return "X'"+Buffer.from(String(node.value),'base64').toString('hex')+"'"; if(node.value===null) return 'NULL'; if(typeof node.value==='boolean') return node.value?'1':'0'; if(typeof node.value==='number') return String(node.value); if(node.value.includes('\0')) fail('UNSAFE_EXPRESSION',table.id,'NUL literals are unsupported.'); return "'"+node.value.replaceAll("'","''")+"'";
 case 'field': { if(mode==='default' || !['self','row',table.id,table.physicalName].includes(node.alias)) fail('UNSAFE_EXPRESSION',table.id,'Only local row fields are allowed in this expression.'); const column=table.columns.find(c=>c.id===node.fieldId); if(!column) fail('BROKEN_REFERENCE',node.fieldId,'Expression field is not present in the source row.'); return quote(column.physicalName); }
 case 'binary': if(hasDecimal(node,table)) fail('UNSUPPORTED_SCHEMA_OBJECT',table.id,'Exact-decimal arithmetic and comparisons require the decimal expression compiler; SQLite numeric coercion is unsafe.'); return '('+expression(node.left,table,mode)+' '+node.operator.toUpperCase()+' '+expression(node.right,table,mode)+')';
 case 'function': { const arities={coalesce:[2,16],lower:[1,1],upper:[1,1],length:[1,1],abs:[1,1],date:[1,1],year:[1,1]} as const; const range=arities[node.function]; if(node.args.length<range[0] || node.args.length>range[1]) fail('UNSAFE_EXPRESSION',table.id,'Function arity is unsupported.'); if(node.function==='abs' && hasDecimal(node,table)) fail('UNSUPPORTED_SCHEMA_OBJECT',table.id,'Decimal abs requires the exact-decimal compiler.'); const args=node.args.map(a=>expression(a,table,mode)); return node.function==='year'?`CAST(strftime('%Y', ${args[0]}) AS INTEGER)`:`${node.function}(${args.join(', ')})`; }
 default: return fail('UNSAFE_EXPRESSION',table.id,'Parameters and aggregates are not allowed in schema expressions.');
 }
}
function names(table: Table, ids: readonly string[]) { return ids.map(id=> { const c=table.columns.find(c=>c.id===id); if(!c) fail('BROKEN_REFERENCE',id,'Constraint column does not exist.'); return quote(c.physicalName); }).join(', '); }
function sqlType(column: Table['columns'][number]) { const type=column.type; return type.kind==='decimal'?(type.encoding==='text'?'TEXT':'INTEGER'):['boolean','integer'].includes(type.kind)?'INTEGER':type.kind==='real'?'REAL':type.kind==='blob'?'BLOB':'TEXT'; }
interface RebuildLayout {
 columnTypes: Map<string, string>;
 notNull: Map<string, boolean>;
 primaryKeyParts: { columnId: string; direction: 'ASC' | 'DESC' }[];
 descendingPrimaryKeyId?: string;
 aliasesRowid: boolean;
 sourceAliasId?: string;
}
/** INTEGER affinity is not evidence of a rowid alias. SQLite gives independent
 * INT keys and inline INTEGER PRIMARY KEY DESC keys a real PK index. */
function rebuildLayout(table: Table, source?: Table, physical?: PhysicalTable): RebuildLayout {
 const columnTypes = new Map<string, string>();
 const notNull = new Map<string, boolean>();
 for (const column of table.columns) {
  const old = source?.columns.find(c => c.id === column.id);
  const observed = physical?.columns.find(c => c.name === old?.physicalName);
  if (old && observed && equal(old.type, column.type)) {
   if (!/^(INTEGER|INT|REAL|TEXT|BLOB)$/i.test(observed.type)) fail('UNSUPPORTED_SCHEMA_OBJECT', column.id, 'Physical type declaration cannot be preserved by the rebuild compiler.');
   columnTypes.set(column.id, observed.type);
  }
  if (old && observed && old.nullable === column.nullable) notNull.set(column.id, !!observed.notnull);
 }
 const physicalKeys = physical?.columns.filter(c => c.pk > 0).sort((a,b) => a.pk-b.pk) ?? [];
 const pkIndex = physical?.indexes.find(i => i.origin === 'pk');
 const retainedParts = new Map<string, RebuildLayout['primaryKeyParts'][number]>();
 if (physical && source) {
  const mappedKeys = physicalKeys.map(c => source.columns.find(old => old.physicalName === c.name)?.id);
  if (!equal(mappedKeys, source.primaryKey)) fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, 'Inspected primary-key columns do not have a complete logical mapping.');
  if (pkIndex) {
   const parts = pkIndex.columns.filter(c => c.key).sort((a,b) => a.seqno-b.seqno);
   if (pkIndex.unique !== 1 || pkIndex.partial || parts.length !== physicalKeys.length) fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, 'Inspected primary-key index cannot be preserved completely.');
   parts.forEach((part,i) => {
    const column = physicalKeys[i]!, id = mappedKeys[i];
    if (!id || part.cid !== column.cid || part.name !== column.name || ![0,1].includes(part.desc) || part.coll !== 'BINARY') fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, `Inspected primary-key index ${pkIndex.name} has unsupported column, direction or collation metadata. Leave this table unchanged.`);
    retainedParts.set(id, { columnId: id, direction: part.desc ? 'DESC' : 'ASC' });
   });
  } else if (physicalKeys.length && (physicalKeys.length !== 1 || !/^INTEGER$/i.test(physicalKeys[0]!.type))) fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, 'Inspected primary key has neither a verified index nor an INTEGER rowid alias.');
  // An unsupported anonymous UNIQUE may have no SQL object and was omitted by
  // logical import. Do not interpret that omission as an authorized deletion.
  for (const index of physical.indexes.filter(i => i.origin === 'u')) {
   const parts = index.columns.filter(c => c.key).sort((a,b) => a.seqno-b.seqno);
   const ids = parts.map(p => source.columns.find(c => c.physicalName === p.name)?.id);
   if (index.unique !== 1 || index.partial || parts.some(p => p.cid < 0 || p.desc !== 0 || p.coll !== 'BINARY') || ids.some(id => !id) || !source.uniqueConstraints.some(u => equal(u.columnIds, ids))) fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, `Inspected UNIQUE index ${index.name} has unsupported direction/collation or no verified logical constraint. Leave this table unchanged until preservation is supported.`);
  }
 }
 const primaryKeyParts: RebuildLayout['primaryKeyParts'] = table.primaryKey.map(id => retainedParts.get(id) ?? { columnId: id, direction: 'ASC' });
 const sourceKey = physicalKeys.length === 1 ? physicalKeys[0] : undefined;
 const oldKey = source?.columns.find(c => c.physicalName === sourceKey?.name);
 const sourceAliasId = sourceKey && /^INTEGER$/i.test(sourceKey.type) && !pkIndex ? oldKey?.id : undefined;
 let descendingPrimaryKeyId: string | undefined;
 if (oldKey && table.primaryKey.length === 1 && table.primaryKey[0] === oldKey.id && /^INTEGER$/i.test(columnTypes.get(oldKey.id) ?? '')) {
  const indexKeys = pkIndex?.columns.filter(c => c.key) ?? [];
  if (!sourceAliasId && sourceKey && /^INTEGER$/i.test(sourceKey.type)) {
   if (indexKeys.length !== 1 || indexKeys[0]!.name !== sourceKey.name || indexKeys[0]!.desc !== 1 || indexKeys[0]!.coll !== 'BINARY') fail('UNSUPPORTED_SCHEMA_OBJECT', table.id, 'Cannot prove the independent INTEGER primary-key storage semantics.');
   descendingPrimaryKeyId = oldKey.id;
  }
 }
 const key = table.primaryKey.length === 1 ? table.columns.find(c => c.id === table.primaryKey[0]) : undefined;
 const aliasesRowid = !!key && /^INTEGER$/i.test(columnTypes.get(key.id) ?? sqlType(key)) && !descendingPrimaryKeyId;
 // A source alias is implicitly non-null even when table_xinfo.notnull is 0.
 // If its alias is explicitly removed, compile the desired NOT NULL constraint.
 if (sourceAliasId && !aliasesRowid) notNull.delete(sourceAliasId);
 return { columnTypes, notNull, primaryKeyParts, aliasesRowid, ...(descendingPrimaryKeyId ? { descendingPrimaryKeyId } : {}), ...(sourceAliasId ? { sourceAliasId } : {}) };
}
function createTable(table: Table, schema: Schema, name=table.physicalName, layout?: RebuildLayout) {
 const defs=table.columns.map(c=> { if(c.generated) fail('UNSUPPORTED_SCHEMA_OBJECT',c.id,'Generated columns are preserved as opaque and cannot be authored or rebuilt.'); return `${quote(c.physicalName)} ${layout?.columnTypes.get(c.id) ?? sqlType(c)}${layout?.descendingPrimaryKeyId === c.id ? ' PRIMARY KEY DESC' : ''}${(layout?.notNull.get(c.id) ?? !c.nullable) ? ' NOT NULL' : ''}${c.default?' DEFAULT ('+expression(c.default,table,'default')+')':''}`; });
 if(table.primaryKey.length && !layout?.descendingPrimaryKeyId) defs.push(`PRIMARY KEY (${layout ? layout.primaryKeyParts.map(part => `${names(table,[part.columnId])} ${part.direction}`).join(', ') : names(table,table.primaryKey)})`);
 for(const u of table.uniqueConstraints) defs.push(`CONSTRAINT ${quote(u.id)} UNIQUE (${names(table,u.columnIds)})`);
 for(const c of table.checks) defs.push(`CONSTRAINT ${quote(c.id)} CHECK (${expression(c.expression,table,'check')})`);
 for(const f of table.foreignKeys) { const target=schema.tables.find(t=>t.id===f.referencedTableId); if(!target) fail('BROKEN_REFERENCE',f.id,'Referenced table does not exist.'); defs.push(`CONSTRAINT ${quote(f.id)} FOREIGN KEY (${names(table,f.columnIds)}) REFERENCES ${quote(target.physicalName)} (${names(target,f.referencedColumnIds)}) ON UPDATE ${f.onUpdate.replaceAll('-',' ').toUpperCase()} ON DELETE ${f.onDelete.replaceAll('-',' ').toUpperCase()}${f.deferrable?' DEFERRABLE INITIALLY DEFERRED':''}`); }
 return `CREATE TABLE ${quote(name)} (${defs.join(', ')})`;
}
function indexes(table:Table) { return table.indexes.map(i=>`CREATE ${i.unique?'UNIQUE ':''}INDEX ${quote(i.physicalName)} ON ${quote(table.physicalName)} (${names(table,i.columnIds)})${i.where?' WHERE '+expression(i.where,table,'check'):''}`); }
function diff(baseline:Schema,desired:Schema):SchemaChange[] {
 const changes: SchemaChange[]=[];
 const add=(tableId:string,objectId:string,kind:SchemaChange['kind'],description:string)=>changes.push({tableId,objectId,kind,description});
 for(const old of baseline.tables) {
  const next=desired.tables.find(t=>t.id===old.id); if(!next) {add(old.id,old.id,'drop',`Drop table ${old.physicalName}`);continue;}
  if(old.physicalName!==next.physicalName) add(old.id,old.id,'rename',`Rename table ${old.physicalName} to ${next.physicalName}; preserve row identities`);
  for(const c of old.columns) {const n=next.columns.find(v=>v.id===c.id); if(!n) add(old.id,c.id,'drop',`Drop column ${c.physicalName}`); else {if(c.physicalName!==n.physicalName) add(old.id,c.id,'rename',`Rename column ${c.physicalName} to ${n.physicalName}; preserve values`); if(!equal(c.type,n.type)) add(old.id,c.id,'type',`Convert column ${n.physicalName}`); if(!equal({...c,physicalName:n.physicalName,type:n.type},n)) add(old.id,c.id,'constraint',`Change column constraints for ${n.physicalName}`);}}
  for(const c of next.columns) if(!old.columns.some(v=>v.id===c.id)) add(old.id,c.id,'add',`Add column ${c.physicalName}`);
  for(const [key,kind] of [['primaryKey','key'],['uniqueConstraints','key'],['indexes','index'],['foreignKeys','foreign-key'],['checks','constraint']] as const) if(!equal(old[key],next[key])) add(old.id,old.id,kind,`Change ${key} on ${next.physicalName}`);
 }
 for(const table of desired.tables) for(const fk of table.foreignKeys) { const old=baseline.tables.find(t=>t.id===table.id)?.foreignKeys.find(f=>f.id===fk.id),before=baseline.tables.find(t=>t.id===fk.referencedTableId),after=desired.tables.find(t=>t.id===fk.referencedTableId); if(old && before && after && equal(old,fk) && (before.physicalName!==after.physicalName || fk.referencedColumnIds.some(id=>before.columns.find(c=>c.id===id)?.physicalName!==after.columns.find(c=>c.id===id)?.physicalName))) add(table.id,fk.id,'foreign-key','Rewrite physical foreign-key names after a coordinated target rename'); }
 for(const t of desired.tables) if(!baseline.tables.some(v=>v.id===t.id)) add(t.id,t.id,'add',`Create table ${t.physicalName}`);
 return changes;
}
/** Runs in the read-only SQLite child. A single read transaction pins schema and row observations. */
export function planSchema(db:Database.Database,input:SchemaPlanInput):SchemaPlanResult {
 const empty: SchemaPlanResult={diagnostics:[],changes:[],steps:[],impact:[],schemaFingerprint:'',dataFingerprint:'',sqliteVersion:'',strategy:'rebuild'};
 try { return db.transaction(()=>compile(db,input,empty))(); }
 catch(error) { if(error instanceof PlanningError) return {...empty,steps:[],diagnostics:[error.diagnostic]}; throw error; }
}
function compile(db:Database.Database,input:SchemaPlanInput,result:SchemaPlanResult):SchemaPlanResult {
 const baseline=schemaSchema.parse(input.baseline),desired=schemaSchema.parse(input.desired); const physical=inspectDatabase(db); result.schemaFingerprint=physical.fingerprint; result.sqliteVersion=physical.sqliteVersion;
 if(physical.fingerprint!==input.schemaFingerprint) fail('DATABASE_CHANGED',baseline.id,'Database schema changed since inspection. Reinspect before preview.');
 const digest=createHash('sha256');
 for(const table of [...physical.tables].sort((a,b)=>a.name.localeCompare(b.name))) { digest.update(JSON.stringify(table.name)); const rowid=['rowid','_rowid_','oid'].find(name=>!table.columns.some(c=>c.name.toLowerCase()===name)); const withoutRowid=/\bWITHOUT\s+ROWID\b/i.test(physical.objects.find(o=>o.type==='table' && o.name===table.name)?.sql??''); const rows=db.prepare(`SELECT ${rowid && !withoutRowid?quote(rowid)+', ':''}* FROM ${quote(table.name)}`).safeIntegers().raw().iterate(); const rowHashes:string[]=[]; for(const row of rows) rowHashes.push(createHash('sha256').update(JSON.stringify(row,(_key,value:unknown)=>typeof value==='bigint'?{integer:String(value)}:value)).digest('hex')); rowHashes.sort(); for(const h of rowHashes) digest.update(h); }
 result.dataFingerprint=digest.digest('hex'); result.changes=diff(baseline,desired);
 if(!equal(baseline.opaqueObjects,desired.opaqueObjects)) fail('UNSUPPORTED_SCHEMA_OBJECT',baseline.id,'Opaque SQL must remain unchanged in the candidate.');
 const objectNames=new Set<string>();
 for(const table of desired.tables) for(const object of [table,...table.indexes]) {const key=object.physicalName.toLowerCase();if(key.startsWith('sqlite_') || objectNames.has(key) || desired.opaqueObjects.some(o=>o.kind!=='table' && o.physicalName.toLowerCase()===key)) fail('VALIDATION_FAILED',object.id,'Physical table/index names must be distinct and cannot use SQLite reserved names.');objectNames.add(key);}
 const changed=new Set(result.changes.map(c=>c.tableId));
 for(const object of baseline.opaqueObjects) if(changed.size && (object.dependencies.some(id=>changed.has(id)) || ['view','trigger'].includes(object.kind))) fail('UNSUPPORTED_SCHEMA_OBJECT',object.id,`Cannot prove preservation of opaque ${object.kind} ${object.physicalName}. Leave its dependencies unchanged.`);
 // A baseline must describe the entire real database; missing baseline identities cannot be guessed.
 if(baseline.tables.length!==physical.tables.length || baseline.tables.some(t=>!physical.tables.some(p=>p.name===t.physicalName && p.columns.length===t.columns.length && p.columns.every(c=>t.columns.some(v=>v.physicalName===c.name))))) fail('DATABASE_CHANGED',baseline.id,'Inspected baseline no longer describes physical columns. Reinspect.');
 const backfills=new Map<string,Expression>();
 for(const b of input.backfills) {const key=JSON.stringify([b.tableId,b.columnId]); if(backfills.has(key) || !desired.tables.some(t=>t.id===b.tableId && t.columns.some(c=>c.id===b.columnId)) || !baseline.tables.some(t=>t.id===b.tableId)) fail('INVALID_INPUT',b.columnId,'Backfill must identify one existing source table and candidate column exactly once.'); backfills.set(key,expressionSchema.parse(b.expression)); if(!changed.has(b.tableId)) fail('INVALID_INPUT',b.columnId,'Backfill needs an explicit schema change.'); }
 for(const table of desired.tables) for(const column of table.columns) if(column.default) {
  let value=db.prepare(`SELECT ${expression(column.default,table,'default')}`).safeIntegers().pluck().get() as unknown;
  if(column.type.kind==='blob' && Buffer.isBuffer(value)) value=value.toString('base64');
  else if(column.type.kind==='boolean' && (value===0n || value===1n)) value=value===1n;
  else if(column.type.kind==='decimal' && column.type.encoding==='scaled-integer' && typeof value==='bigint') value=new Decimal(value.toString()).div(new Decimal(10).pow(column.type.scale)).toFixed(column.type.scale);
  else if(typeof value==='bigint' && ['integer','real'].includes(column.type.kind)) value=Number(value);
  if(!isLiteralValue(value,column.type,column.nullable)) fail('VALIDATION_FAILED',column.id,'Default expression evaluates to an invalid logical value, even with no existing rows.');
 }
 const projected=new Map<string,{table:Table;source:Table|undefined;select:string;copies:string[];count:number}>();
 for(const table of desired.tables) {
  const source=baseline.tables.find(t=>t.id===table.id); const count=source?Number(db.prepare(`SELECT count(*) FROM ${quote(source.physicalName)}`).pluck().get()):0;
  const copies=table.columns.map(c=> {const old=source?.columns.find(v=>v.id===c.id); const fill=backfills.get(JSON.stringify([table.id,c.id])); if(old && !equal(old.type,c.type) && !fill && count) fail('VALIDATION_FAILED',c.id,'Type changes on populated data require an explicit validated conversion expression.'); if(fill && source) {result.impact.push({id:createId(),objectId:c.id,kind:'backfill',description:`Replace values in ${table.physicalName}.${c.physicalName} with the reviewed expression`,requiresAcknowledgement:true,affectedCount:count});return expression(fill,source,'copy');} return old?quote(old.physicalName):c.default?expression(c.default,table,'default'):'NULL'; });
  const select=`SELECT ${copies.map((s,i)=>`${s} AS ${quote(table.columns[i]!.physicalName)}`).join(', ')}${source?' FROM main.'+quote(source.physicalName):' WHERE 0'}`;
  projected.set(table.id,{table,source,select,copies,count});
 }
 const cteNames=new Map(desired.tables.map((t,i)=>[t.id,`__preview_${i}`])); const ctes=[...projected.values()].map(p=>`${quote(cteNames.get(p.table.id)!)} AS (${p.select})`).join(', ');
 const count=(query:string)=>Number(db.prepare(`WITH ${ctes} ${query}`).pluck().get());
 for(const p of projected.values()) {
  const {table}=p, from=quote(cteNames.get(table.id)!);
  for(const c of table.columns) {
   if(!changed.has(table.id)) continue;
   const col=quote(c.physicalName); if(!c.nullable && count(`SELECT count(*) FROM ${from} WHERE ${col} IS NULL`)) fail('VALIDATION_FAILED',c.id,'Existing rows need a non-null default or explicit backfill.');
   // A constraint preview must not rely on SQLite silently coercing incompatible data.
   let invalid:string; switch(c.type.kind) {case 'integer': invalid=`typeof(${col}) != 'integer'`;break;case 'real':invalid=`typeof(${col}) NOT IN ('integer','real') OR abs(${col}) > 1.7976931348623157e308`;break;case 'boolean':invalid=`typeof(${col}) != 'integer' OR ${col} NOT IN (0,1)`;break;case 'blob':invalid=`typeof(${col}) != 'blob'`;break;case 'decimal': { const type=c.type; for(const row of db.prepare(`WITH ${ctes} SELECT ${col} AS value FROM ${from} WHERE ${col} IS NOT NULL`).safeIntegers().iterate() as Iterable<{value:unknown}>) { const value=row.value; const decoded=type.encoding==='scaled-integer' && typeof value==='bigint'?new Decimal(value.toString()).div(new Decimal(10).pow(type.scale)).toFixed(type.scale):value; if(!isLiteralValue(decoded,type,false) || type.encoding==='scaled-integer' && typeof value!=='bigint') fail('VALIDATION_FAILED',c.id,'Projected decimal values violate encoding, precision or scale.'); } invalid='0';break; }case 'date':invalid=`typeof(${col}) != 'text' OR length(${col}) != 10 OR date(${col}, '+0 days') IS NULL OR date(${col}, '+0 days') != ${col}`;break;case 'datetime':invalid=`typeof(${col}) != 'text' OR strftime('%Y-%m-%dT%H:%M:%fZ',${col}) IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ',${col}) NOT IN (${col}, substr(${col}, 1, 19) || '.000Z')`;break;default:invalid=`typeof(${col}) != 'text'`;}
   if(count(`SELECT count(*) FROM ${from} WHERE ${col} IS NOT NULL AND (${invalid})`)) fail('VALIDATION_FAILED',c.id,'Projected values do not match the declared logical type. Supply a supported conversion.');
  }
  for(const u of [{id:table.id,columnIds:table.primaryKey},...table.uniqueConstraints,...table.indexes.filter(i=>i.unique)]) {if(!u.columnIds.length)continue; const where='where' in u && u.where?expression(u.where as Expression,table,'check'):undefined; const nonnull=u.columnIds.map(id=>`${names(table,[id])} IS NOT NULL`).join(' AND ');if(count(`SELECT count(*) FROM (SELECT 1 FROM ${from} WHERE ${nonnull}${where?' AND ('+where+')':''} GROUP BY ${names(table,u.columnIds)} HAVING count(*)>1)`)) fail('VALIDATION_FAILED',u.id,'Projected rows violate a primary or unique key.');}
  for(const check of table.checks) if(count(`SELECT count(*) FROM ${from} WHERE (${expression(check.expression,table,'check')}) = 0`)) fail('VALIDATION_FAILED',check.id,'Projected rows violate a CHECK constraint.');
  for(const fk of table.foreignKeys) {const target=desired.tables.find(t=>t.id===fk.referencedTableId)!; const local=fk.columnIds.map(id=>table.columns.find(c=>c.id===id)!);const remote=fk.referencedColumnIds.map(id=>target.columns.find(c=>c.id===id)!);if(count(`SELECT count(*) FROM ${from} AS local WHERE ${local.map(c=>'local.'+quote(c.physicalName)+' IS NOT NULL').join(' AND ')} AND NOT EXISTS (SELECT 1 FROM ${quote(cteNames.get(target.id)!)} AS remote WHERE ${local.map((c,i)=>'local.'+quote(c.physicalName)+' = remote.'+quote(remote[i]!.physicalName)).join(' AND ')})`)) fail('VALIDATION_FAILED',fk.id,'Projected rows violate the candidate foreign key.');}
 }
 const step=(sql:string,objectIds:string[])=>result.steps.push({id:createId(),sql,objectIds:objectIds.map(id=>createId(()=>id)),transactional:true});
 // Native renames are safe only for a single isolated rename. Coordinated changes use a rebuild.
 const only=result.changes[0]; const version=physical.sqliteVersion.split('.').map(Number); const native=input.backfills.length===0 && only && result.changes.length===1 && only.kind==='rename' && !baseline.tables.some(t=>t.foreignKeys.some(f=>f.referencedTableId===only.tableId));
 if(native && (only.objectId===only.tableId || (version[0]!>3 || version[0]===3 && version[1]!>=25))) {
  result.strategy='native'; const old=baseline.tables.find(t=>t.id===only.tableId)!,next=desired.tables.find(t=>t.id===only.tableId)!;
  step(only.objectId===only.tableId?`ALTER TABLE ${quote(old.physicalName)} RENAME TO ${quote(next.physicalName)}`:`ALTER TABLE ${quote(old.physicalName)} RENAME COLUMN ${quote(old.columns.find(c=>c.id===only.objectId)!.physicalName)} TO ${quote(next.columns.find(c=>c.id===only.objectId)!.physicalName)}`,[only.objectId]);
 } else {
  // All changed tables are staged before originals are dropped; executor disables FK checks before BEGIN.
  const staged=new Map<string,string>(); const occupied=new Set(physical.objects.map(o=>o.name.toLowerCase()));
  for(const p of projected.values()) if(changed.has(p.table.id)) {let temporary:string;do {temporary='__baron_'+createId().replaceAll('-','');}while(occupied.has(temporary.toLowerCase()));occupied.add(temporary.toLowerCase());staged.set(p.table.id,temporary); const layout = rebuildLayout(p.table, p.source, physical.tables.find(t => t.name === p.source?.physicalName)); if (p.source && layout.aliasesRowid && (layout.sourceAliasId !== p.table.primaryKey[0] || backfills.has(JSON.stringify([p.table.id, p.table.primaryKey[0]])))) fail('UNSUPPORTED_SCHEMA_OBJECT', p.table.id, 'Rebuild would change independent row identity into a rowid alias or replace aliased row identities. Preserve the physical primary key or use a separately supported identity migration.'); step(createTable(p.table,desired,temporary,layout),[p.table.id]); if(p.source) { const integerKey=layout.aliasesRowid; const sourceRowid=['rowid','_rowid_','oid'].find(name=>!p.source!.columns.some(c=>c.physicalName.toLowerCase()===name)); const targetRowid=['rowid','_rowid_','oid'].find(name=>!p.table.columns.some(c=>c.physicalName.toLowerCase()===name)); if(!integerKey && (!sourceRowid || !targetRowid)) fail('UNSUPPORTED_SCHEMA_OBJECT',p.table.id,'Shadowed rowid aliases prevent a proven row-identity-preserving rebuild.'); step(`INSERT INTO ${quote(temporary)} (${!integerKey?quote(targetRowid!)+', ':''}${names(p.table,p.table.columns.map(c=>c.id))}) ${!integerKey?'SELECT '+quote(sourceRowid!)+', '+p.copies.map((v,i)=>v+' AS '+quote(p.table.columns[i]!.physicalName)).join(', ')+' FROM main.'+quote(p.source.physicalName):p.select}`,[p.table.id]); }}
  for(const old of baseline.tables) if(changed.has(old.id)) step(`DROP TABLE ${quote(old.physicalName)}`,[old.id]);
  for(const p of projected.values()) if(changed.has(p.table.id)) {step(`ALTER TABLE ${quote(staged.get(p.table.id)!)} RENAME TO ${quote(p.table.physicalName)}`,[p.table.id]); for(const sql of indexes(p.table))step(sql,[p.table.id]);}
 }
 for(const c of result.changes) {const old=baseline.tables.find(t=>t.id===c.tableId); const n=old?Number(db.prepare(`SELECT count(*) FROM ${quote(old.physicalName)}`).pluck().get()):0; result.impact.push({id:createId(),objectId:createId(()=>c.objectId),kind:c.kind==='drop'?'data-loss':c.kind==='add'?'create':'change',description:c.description,requiresAcknowledgement:c.kind==='drop'||c.kind==='type'||c.kind==='key',affectedCount:n});}
 // Dropping a table discloses its outgoing dependencies as well as row loss; no implicit cascade is executed.
 for(const old of baseline.tables.filter(t=>!desired.tables.some(n=>n.id===t.id))) for(const fk of old.foreignKeys) result.impact.push({id:createId(),objectId:fk.id,kind:'delete',description:'Remove relationship with dropped table',requiresAcknowledgement:true});
 return result;
}
