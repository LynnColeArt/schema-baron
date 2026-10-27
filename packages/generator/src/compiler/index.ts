import {compileDerived} from '../templates/derived/index.js';
import {compileQueries,QueryCompilationError} from '../templates/report/queries.js';
import { compatibleMapping } from '../templates/auth/store.js';
import { compileDestination, contextFields, keyParameter } from '../templates/navigation/index.js';
import { ModelValidationError, parseProject, effectiveAccess } from '@schema-baron/model';
import type { Diagnostic, Project } from '@schema-baron/model';
import type { ActionIR, GenerationIR, RouteIR, SourceIR } from '../ir/index.js';
export class GenerationError extends Error { constructor(readonly diagnostics:Diagnostic[]) { super(diagnostics[0]?.message ?? 'Generation failed.'); } }
export function compileProject(input:Project):GenerationIR {
 let project:Project; try { project=parseProject(input); } catch(error) { if(error instanceof ModelValidationError) throw new GenerationError(error.diagnostics); throw error; }
 const diagnostics:Diagnostic[]=[];
 const fail=(objectId:string,message:string)=>diagnostics.push({code:'UNSUPPORTED_SCHEMA_OBJECT',severity:'error',objectId:objectId as Project['id'],message,recoveryAction:'Remove this feature from the output project or wait for its generator capability.'});
 if(project.connections.length!==1) fail(project.id,'Public Grid generation requires one bound SQLite connection.');
 let queries:GenerationIR['queries'];try{queries=compileQueries(project);}catch(error){if(error instanceof QueryCompilationError)throw new GenerationError(error.diagnostics);throw error;}
 let mapping;try {mapping=compatibleMapping(project);}catch(error){fail(project.id,error instanceof Error?error.message:'Identity mapping is incompatible.');}
 if(!project.identity&&project.policies.some(p=>p.access==='authenticated'))fail(project.id,'Configure identity before generating authenticated policies.');
 if(project.identity&&project.policies.some(p=>p.access==='authenticated')&&!project.forms.some(f=>f.kind==='Login'&&effectiveAccess(project,f.pageId).access==='public'&&f.actionIds.some(id=>{const a=project.actions.find(a=>a.id===id);return a?.operation==='login'&&effectiveAccess(project,f.pageId,id).access==='public';})))fail(project.id,'Provide a public Login form and login action before generating authenticated policies.');
 for(const extension of project.extensionContracts) fail(extension.id,'Extension ownership requires the regeneration capability.');

 const sources:SourceIR[]=project.schema.tables.map(t=>({id:t.id,kind:'table',name:t.physicalName,fields:t.columns.map(c=>({id:c.id,name:c.physicalName,type:c.type,nullable:c.nullable,...(c.generated?{generated:true}:{}),...(c.default?{hasDefault:true}:{})})),keys:t.primaryKey}));
 sources.push(...project.queries.map(q=>({id:q.id,kind:'query' as const,name:q.name,fields:q.projections.map(f=>({id:f.id,name:f.id,type:f.type,nullable:f.nullable})),keys:q.grain.keys})));
 const contexts=contextFields(project,sources);
 const routes:RouteIR[]=project.pages.map(page=>{
  if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(page.route) || page.route.endsWith('/')&&page.route!=='/') fail(page.id,'Use a static internal route made of letters, digits, underscores and hyphens.');
  if(page.route.split('/').some(segment=>segment.startsWith('_'))) fail(page.id,'Route segments beginning with an underscore are private in Next.js. Rename this public route before generation.');
  const global=project.policies.find(p=>p.id===project.globalPolicyId)!;const local=project.policies.find(p=>p.id===page.policyId);const effective=local&&local.access!=='inherit'?local:global;

  const records:RouteIR['records']=[],logins:RouteIR['logins']=[];
  const grids=page.formIds.flatMap(id=>{
   const form=project.forms.find(f=>f.id===id)!;let source=sources.find(s=>s.id===form.sourceRef?.id);
   if(form.kind==='Login') {
    const controls=form.controlIds.map(id=>project.controls.find(c=>c.id===id)!);
    const usernames=controls.filter(c=>c.credentialRole==='username'),passwords=controls.filter(c=>c.credentialRole==='password');
    if(!project.identity||usernames.length!==1||passwords.length!==1||usernames[0]!.binding||passwords[0]!.binding)fail(form.id,'Login requires configured identity and exactly one explicit username and password credential role without data bindings.');
    const actions=form.actionIds.map(id=>project.actions.find(a=>a.id===id)!).map(action=>{
     if(!['login','logout'].includes(action.operation))fail(action.id,'Login forms support explicit login/logout actions.');
     const result:ActionIR={id:action.id,operation:action.operation,access:effectiveAccess(project,page.id,action.id).access};
     for(const slot of ['destination','success','cancel'] as const)if(action[slot])try{result[slot]=compileDestination(project,sources,action[slot]!,action.operation);}catch(error){fail(action.id,error instanceof Error?error.message:'Invalid login destination.');}
     return result;
    });
    logins.push({id:form.id,username:usernames[0]?.id??'',password:passwords[0]?.id??'',actions});return [];
   }
   if(!['Grid','Search','Record'].includes(form.kind)||!source||source.kind==='query'&&form.kind!=='Grid') {fail(form.id,'Generate a table-bound Grid, Search or Record, or query-bound Grid form.');return [];}
   let reportQueryId=source.id;
   if(source.kind==='query')for(const input of queries.find(q=>q.id===source!.id)!.inputs)if(input.default===undefined&&!form.queryParameters?.some(mapping=>mapping.parameterId===input.id))fail(form.id,'Bind required query parameter '+input.name+' to a fixed literal or a named runtime input before generating this report.');
   try{const derived=compileDerived(project,form);if(derived){queries.push(derived.plan);reportQueryId=derived.queryId;source={...source,fields:[...source.fields,...derived.fields.map(f=>({id:f.id,name:f.id,type:f.type,nullable:f.nullable}))]};}}catch(error){if(error instanceof ModelValidationError||error instanceof QueryCompilationError)diagnostics.push(...error.diagnostics.map(d=>({...d,objectId:form.id})));else fail(form.id,error instanceof Error?error.message:'Invalid derived binding.');}
   if(source.kind==='query'&&form.keyMapping.length)fail(form.id,'Report row identity comes from saved-query grain keys. Use typed query runtime parameters for incoming parent filters.');
   for(const key of form.keyMapping) if(key.expression.kind!=='field'||key.expression.alias!=='root'||key.expression.fieldId!==key.targetFieldId) fail(form.id,'Form keys must bind their own stored field. Supply incoming literal or source values through declared action key/filter mappings.');
   const actions=form.actionIds.map(id=>project.actions.find(a=>a.id===id)!).map(action=>{
    if(source.kind==='query'&&effectiveAccess(project,page.id,action.id).access==='authenticated'&&['navigate','search'].includes(action.operation))fail(action.id,'Authenticated query navigation or Search requires a proven keyed-query read guard. Keep report navigation public and protect the destination Record page, or remove this action before generation.');
    if(!['navigate','cancel','search','insert','update','delete'].includes(action.operation)||action.extensionHookRef) fail(action.id,'This action requires a later runtime capability.');
    if(form.kind!=='Record'&&['insert','update','delete'].includes(action.operation)) fail(action.id,'Writes require a Record form.');
    const result:ActionIR={id:action.id,operation:action.operation,access:effectiveAccess(project,page.id,action.id).access};
    for(const slot of ['destination','success','cancel'] as const) if(action[slot]) try {result[slot]=compileDestination(project,sources,action[slot]!,action.operation);}catch(error){fail(action.id,error instanceof Error?error.message:'Invalid destination.');}
    if(['insert','update','delete'].includes(action.operation)&&!action.success&&!action.destination) fail(action.id,'Declare a success destination for this write.');
    return result;
   });
   if(source.kind==='query'&&(form.search.length||form.sorting.length))fail(form.id,'Use saved-query WHERE/HAVING parameters and query ordering for reports; table search/sort declarations require a table source.');
   for(const sorting of form.sorting){const field=source.fields.find(f=>f.id===sorting.fieldId);if(source.kind==='table'&&field?.type.kind==='decimal'&&field.type.encoding==='text') fail(form.id,'Exact decimal text sorting is unavailable in this output slice.');}

   if(!form.controlIds.length) fail(form.id,'Select at least one Grid display control before generation.');
   const controls=form.controlIds.map(id=>{
    const c=project.controls.find(c=>c.id===id)!;
    if(!['label','text','number','date','checkbox','select','link','button'].includes(c.kind)||c.binding?.kind==='derived'&&source.kind!=='query') fail(c.id,'This control requires a generator capability that is not available yet.');
    if(c.appearance.className||c.appearance.width) fail(c.id,'Custom control layout generation is not available yet.');
    if(c.lookup&&(c.lookup.source.kind!=='table'||c.lookup.valueFieldIds.length!==1)) fail(c.id,'Lookup requires one table value field.');
    return {id:c.id,kind:c.kind,readOnly:c.readOnly,validation:c.validation,events:c.events,...(c.lookup?{lookup:c.lookup}:{}),...(c.binding?.kind==='stored'?{fieldId:c.binding.fieldId}:c.binding?.kind==='derived'?{fieldId:c.id}:{}),label:c.appearance.label??(c.binding?.kind==='stored'?source.fields.find(f=>c.binding?.kind==='stored'&&f.id===c.binding.fieldId)?.name:undefined)??c.kind,format:c.appearance.format??'plain' as const};
   });
   if(!controls.some(c=>c.fieldId)) fail(form.id,'Bind at least one Grid display control to a stored field.');
   if(form.appearance.className||form.appearance.width||form.appearance.format&&form.appearance.format!=='plain') fail(form.id,'Custom Grid layout/format generation is not available yet.');
   if(form.kind==='Record') {
    if(form.actionIds.some(id=>project.actions.find(a=>a.id===id)?.operation==='delete')&&!form.displayFieldIds?.length) fail(form.id,'Select Record name fields in Data properties before enabling Delete.');
    const physical=project.connections[0]?.physical;
    const table=physical?.tables.find(t=>t.name===source.name);
    const sql=physical?.objects.find(o=>o.type==='table'&&o.name===source.name)?.sql??'';
    const automatic=source.keys.length===1&&table?.columns.find(c=>c.pk===1)?.type.toUpperCase()==='INTEGER'&&!table.indexes.some(i=>i.origin==='pk')&&!/\bWITHOUT\s+ROWID\b/i.test(sql)?source.keys[0]:undefined;
    for(const field of source.fields) if(!field.nullable&&!field.generated&&!field.hasDefault&&field.id!==automatic&&!controls.some(c=>c.fieldId===field.id)) fail(form.id,'Select an editable control for required field '+field.name+'.');
    const config={id:form.id,pageId:page.id,source:{...source,table:source.name},keyParameters:source.keys.map(id=>keyParameter(form,id)),displayFields:form.displayFieldIds??[],context:contexts,actions,controls:controls.map(control=>({...control,...(control.lookup?{lookup:{source:{...sources.find(s=>s.id===control.lookup!.source.id)!,table:sources.find(s=>s.id===control.lookup!.source.id)!.name},valueFieldId:control.lookup.valueFieldIds[0],labelFieldId:control.lookup.labelFieldId}}:{})}))};
    records.push({id:form.id,label:form.appearance.label??'Record',source,controls,config});return [];
   }
   return [{pageId:page.id,kind:form.kind,actions,context:contexts,id:form.id,label:form.appearance.label??'Records',source,controls,keyMapping:form.keyMapping,search:form.search,sorting:form.sorting,pageSize:form.paging.pageSize,...(source.kind==='query'?{report:{queryId:reportQueryId,parameters:form.queryParameters}}:{})}];
  });
  return {id:page.id,path:page.route,title:page.title,document:page.document,grids,records,logins,policy:{access:effective.access as 'public'|'authenticated',sourceId:effective.id}};
 });
 if(!routes.length) fail(project.id,'Create a page and table-bound Grid before generating.');
 if(diagnostics.length) throw new GenerationError(diagnostics);
 return {projectId:project.id,revision:project.revision,name:project.name,routes,sources,contexts,...(project.identity?{auth:{...(mapping?{mapping}:{})}}:{}),queries};
}
