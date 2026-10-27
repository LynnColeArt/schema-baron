import {parseProject,canonicalJson} from '@schema-baron/model';
import type {Expression,Form,Project,Query,ScalarType,StableId} from '@schema-baron/model';
import {compileQueries} from '../report/queries.js';
/** Derived report controls are projections of the saved query's exact, refreshed result. */
export function compileDerived(project:Project,form:Form){
 const controls=project.controls.filter(c=>form.controlIds.includes(c.id)&&c.binding?.kind==='derived');
 if(!controls.length)return;
 if(form.sourceRef?.kind!=='query')throw Error('Derived output controls require a saved query source.');
 const source=project.queries.find(q=>q.id===form.sourceRef!.id)!;
 type Shape={type:ScalarType;nullable:boolean};
 function shape(e:Expression):Shape{
  if(e.kind==='field'){const f=source.projections.find(f=>f.id===e.fieldId);if(!f||e.alias!=='root')throw Error('Derived fields must resolve against their query source.');return {type:f.type,nullable:f.nullable};}
  if(e.kind==='literal')return {type:e.type,nullable:e.value===null};
  if(e.kind==='binary'){const a=shape(e.left),b=shape(e.right);return {type:['+','-','*','/'].includes(e.operator)?a.type:{kind:'boolean'},nullable:a.nullable||b.nullable};}
  if(e.kind==='function'){const a=shape(e.args[0]!);return {type:['length','year'].includes(e.function)?{kind:'integer'}:e.function==='date'?{kind:'date',encoding:'iso-date'}:a.type,nullable:e.function==='coalesce'?e.args.every(e=>shape(e).nullable):a.nullable};}
  throw Error('Derived controls use row expressions; aggregate child values in the saved query.');
 }
 const aliases:Record<string,string>={};
 const id=(name:string)=>{const result=('derived:'+form.id+':'+name) as StableId;if([project.id,...project.queries.flatMap(q=>[q.id,...q.projections.map(p=>p.id)]),...project.controls.map(c=>c.id)].includes(result))throw Error('Derived output identifiers collide. Rename the conflicting declaration.');return result;};
 const fields=source.projections.map(f=>{const output=id('field:'+f.id);aliases[output]=f.id;return {id:output,name:f.name,type:f.type,nullable:f.nullable,expression:{kind:'field' as const,alias:'root',fieldId:f.id}};});
 const derived=controls.map(c=>{if(c.binding?.kind!=='derived')throw Error('Missing derived binding.');if(!c.readOnly||!c.binding.sourceDependencies.includes(source.id))throw Error('Derived controls must be read-only and declare their query source dependency.');const output=id('control:'+c.id);aliases[output]=c.id;return {id:output,name:'Derived '+c.id,...shape(c.binding.expression),expression:c.binding.expression};});
 const orderBy:Query['orderBy']=source.orderBy.map(order=>{const field=source.projections.find(p=>canonicalJson(p.expression)===canonicalJson(order.expression));if(!field)throw Error('Project each saved-query order expression before binding derived report controls.');return {direction:order.direction,expression:{kind:'field',alias:'root',fieldId:field.id}};});
 const query:Query={id:id('query'),name:'Derived '+source.name,sources:[{alias:'root',source:{kind:'query',id:source.id}}],joins:[],projections:[...fields,...derived],parameters:[],groupBy:[],orderBy,grain:{strategy:'rows',keys:[]}};
 const checked=parseProject({...project,queries:[...project.queries,query]});
 const plan=compileQueries(checked).find(q=>q.id===query.id)!;
 return {plan:{...plan,aliases},fields:derived.map(f=>({...f,id:aliases[f.id]!})),queryId:query.id};
}
