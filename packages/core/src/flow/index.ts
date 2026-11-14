import {effectiveAccess,validateProject} from '@schema-baron/model';
import type {Diagnostic,Project,StableId} from '@schema-baron/model';
import {compileDestination,contextFields,keyParameter} from '@schema-baron/generator/navigation';
import {authPath,csrfPath,emissionOrder,handlerPath,pageFile} from '@schema-baron/generator/behavior';
import type {ContextIR,DestinationIR,SourceIR} from '@schema-baron/generator';
export interface BehaviorNode {id:string;sourceObjectId:string;kind:string;label:string;pageId:string;access:string;policyId:string;path?:string;operation?:string}
export interface BehaviorEdge {id:string;sourceObjectId:string;fromId:string;toId:string;kind:string;label:string;access:string;policyId:string;valid:boolean;diagnostics:Diagnostic[];mappings:DestinationIR['mappings'];context:ContextIR[];slot?:'destination'|'success'|'cancel';dynamic?:boolean}
export interface Endpoint {id:string;sourceObjectId:string;method:string;path:string;handler:string;access:string;actionIds:string[]}
export interface BehaviorProjection {nodes:BehaviorNode[];edges:BehaviorEdge[];endpoints:Endpoint[];diagnostics:Diagnostic[]}
/** A projection only: no semantic graph persistence, mutation or generator invocation. */
export function projectBehavior(project:Project):BehaviorProjection {
 const nodes:BehaviorNode[]=[],edges:BehaviorEdge[]=[],endpoints:Endpoint[]=[];
 const validation=validateProject(project);
 const diagnostics:Diagnostic[]=validation.ok?[]:validation.diagnostics.map(d=>({...d,objectId:d.objectId??project.id}));
 const fail=(id:string,message:string,code:Diagnostic['code']='BROKEN_REFERENCE')=>diagnostics.push({code,severity:'error',objectId:id as StableId,message});
 const access=(pageId:string,actionId?:string)=>{try{return effectiveAccess(project,pageId,actionId);}catch{fail(actionId??pageId,'Cannot resolve effective access. Repair the page/global policy.');return {access:'unresolved',sourcePolicyId:''};}};
 const sources:SourceIR[]=[...project.schema.tables.map(t=>({id:t.id,kind:'table' as const,name:t.physicalName,keys:t.primaryKey,fields:t.columns.map(c=>({id:c.id,name:c.physicalName,type:c.type,nullable:c.nullable}))})),...project.queries.map(q=>({id:q.id,kind:'query' as const,name:q.name,keys:q.grain.keys,fields:q.projections.map(p=>({id:p.id,name:p.name,type:p.type,nullable:p.nullable}))}))];
 let context:ContextIR[]=[];try{context=contextFields(project,sources).filter(c=>!['key','search','query'].includes(c.kind??'')||c.field!==undefined);}catch{fail(project.id,'Some draft form context cannot be resolved. Repair source bindings.');}
 const returnContext=(pageId:string):ContextIR[]=>[...context,...project.forms.filter(f=>f.pageId===pageId&&f.kind==='Record').flatMap(f=>{const source=sources.find(s=>s.id===f.sourceRef?.id);return [...(source?.keys??[]).flatMap(id=>{const field=source?.fields.find(v=>v.id===id);return field?[{parameter:keyParameter(f,id),kind:'key' as const,field}]:[];}),{parameter:f.id+':mode',kind:'mode' as const}];})];
 const login=project.pages.find(p=>access(p.id).access==='public'&&p.formIds.some(id=>{const f=project.forms.find(f=>f.id===id);return f?.kind==='Login'&&f.actionIds.some(a=>project.actions.some(v=>v.id===a&&v.operation==='login'&&access(p.id,a).access==='public'));}));
 const addNode=(id:string,kind:string,label:string,pageId:string,path?:string)=>{const policy=access(pageId,kind==='action'?id:undefined);const node={id,sourceObjectId:id,kind,label,pageId,access:policy.access,policyId:policy.sourcePolicyId,...(path===undefined?{}:{path})};nodes.push(node);return node;};
 const addEdge=(id:string,sourceObjectId:string,fromId:string,toId:string,kind:string,label:string,policy:{access:string;policyId:string},extra:Partial<BehaviorEdge>={})=>edges.push({id,sourceObjectId,fromId,toId,kind,label,access:policy.access,policyId:policy.policyId,valid:true,diagnostics:[],mappings:[],context:[],...extra});
 for(const page of project.pages){
  const node=addNode(page.id,'page',page.title,page.id,page.route);
  endpoints.push({id:page.id+':GET',sourceObjectId:page.id,method:'GET',path:page.route,handler:pageFile(page.route),access:node.access,actionIds:[]});
  for(const id of page.formIds){const form=project.forms.find(f=>f.id===id);if(!form){fail(page.id,'Page references a missing form.');continue;}const f=addNode(form.id,'form',`${form.kind} · ${form.appearance.label??form.kind}`,page.id);addEdge(form.id+':contains',form.id,page.id,form.id,'contains','contains',f);}
 }
 for(const action of project.actions){const form=project.forms.find(f=>f.id===action.formId);const page=project.pages.find(p=>p.id===form?.pageId);if(!form||!page){fail(action.id,'Action has no existing source form/page.');continue;}
  if(!nodes.some(n=>n.id===form.id)){fail(action.id,'Source form is not placed on its page.');continue;}
  const captions=[...new Set(form.controlIds.flatMap(id=>{const control=project.controls.find(c=>c.id===id);return control?.events.some(e=>e.actionId===action.id)&&control.appearance.label?.trim()?[control.appearance.label.trim()]:[];}))];
  const label=captions.join(' / ')||(action.operation==='insert'||action.operation==='update'?'Save':action.operation==='cancel'?'Cancel':action.operation);
  if(!form.actionIds.includes(action.id)){fail(action.id,'Action is not declared by its source form.');continue;}
  const node=addNode(action.id,'action',label,page.id);Object.assign(node,{operation:action.operation});addEdge(action.id+':invoke',action.id,form.id,action.id,'invoke',label,node);
  for(const slot of ['destination','success','cancel'] as const){const target=action[slot];if(!target)continue;if(!project.pages.some(p=>p.id===target.pageId)){fail(action.id,`Missing ${slot} page. Repair this action in Properties.`);continue;}
   let compiled:DestinationIR;try{compiled=compileDestination(project,sources,target,action.operation);}catch(error){fail(action.id,`${slot}: ${error instanceof Error?error.message:'Invalid parameter mapping.'}`,'VALIDATION_FAILED');continue;}
   // Match the current runtime: Record Cancel uses destination ?? cancel; Login Cancel uses success ?? destination.
   const chosen=action.operation==='cancel'&&form.kind!=='Login'?(action.destination?'destination':'cancel'):action.operation==='navigate'?'destination':action.success?'success':'destination';
   const active=slot===chosen;
   if(!active)continue;
   if(action.operation==='logout')continue;
   addEdge(action.id+':'+slot,action.id,action.id,target.pageId,slot,`${slot} → ${compiled.path}${target.keyMapping.length?' · '+target.keyMapping.length+' key':''}${target.filterMapping.length?' · '+target.filterMapping.length+' filter':''}`,node,{mappings:compiled.mappings,context,slot});
  }
  if(action.operation==='navigate'&&!action.destination)fail(action.id,'Navigation requires a declared destination.','VALIDATION_FAILED');
  if(form.kind==='Record'&&!['insert','update','delete','cancel'].includes(action.operation))fail(action.id,'This Record operation is unavailable in the generated runtime.','UNSUPPORTED_SCHEMA_OBJECT');
  if(['insert','update','delete'].includes(action.operation)&&!action.success&&!action.destination)fail(action.id,'Save/Delete requires a success destination.','VALIDATION_FAILED');
  if(form.kind==='Login'&&action.operation==='cancel'){const target=action.success??action.destination;if(target&&access(target.pageId).access!=='public')fail(action.id,'Login Cancel must return to a public page.','ACCESS_DENIED');}
 }
 // Auth return is a typed dynamic scope, never an invented fixed destination.
 for(const node of nodes.filter(n=>n.access==='authenticated'&&n.kind==='page')){
  if(!login){fail(node.id,'Authenticated behavior needs a public Login form/action.','AUTH_REQUIRED');continue;}
  addEdge(node.id+':gate',node.id,node.id,login.id,'auth','Anonymous → Login; retain typed returnTo',node,{context:returnContext(node.pageId),dynamic:true});
  addEdge(node.id+':return',node.id,login.id,node.id,'return','Login success → validated returnTo',node,{context:returnContext(node.pageId),dynamic:true});
 }
 for(const node of nodes.filter(n=>n.kind==='action'&&n.access==='authenticated'))addEdge(node.id+':session',node.id,node.id,node.id,'authorization','Session required; anonymous handler requests denied',node);
 const fallback=project.pages.find(p=>access(p.id).access==='public'&&!project.forms.some(f=>f.pageId===p.id&&f.kind==='Login'))??project.pages.find(p=>access(p.id).access==='public');
 for(const action of project.actions){const form=project.forms.find(f=>f.id===action.formId);const node=nodes.find(n=>n.id===action.id);if(!node||form?.kind!=='Login'||!fallback)continue;if(action.operation==='logout')addEdge(action.id+':logout',action.id,action.id,fallback.id,'success','Sign out → '+fallback.route,node);if(action.operation==='cancel'&&!action.success&&!action.destination)addEdge(action.id+':fallback',action.id,action.id,fallback.id,'cancel','Cancel → '+fallback.route,node,{context,dynamic:true});}
 const routes=project.pages.map(page=>{const forms=page.formIds.flatMap(id=>{const f=project.forms.find(f=>f.id===id);return f?[f]:[];});return {page,grids:forms.filter(f=>['Grid','Search'].includes(f.kind)),records:forms.filter(f=>f.kind==='Record')};});
 for(const entry of emissionOrder(routes)){const form=project.forms.find(f=>f.id===entry.formId)!;const policy=access(entry.route.page.id);const actions=form.actionIds.filter(id=>project.actions.some(a=>a.id===id));
  if(entry.kind==='record'){for(const method of ['GET','POST'])endpoints.push({id:form.id+':'+method,sourceObjectId:form.id,method,path:handlerPath('record',entry.index),handler:`app${handlerPath('record',entry.index)}/route.ts`,access:policy.access,actionIds:method==='POST'?actions:[]});endpoints.push({id:form.id+':server-action',sourceObjectId:form.id,method:'server action',path:entry.route.page.route,handler:`server/record-action-${entry.index}.ts`,access:policy.access,actionIds:actions});}
  else if(form.sourceRef?.kind!=='query')endpoints.push({id:form.id+':navigation',sourceObjectId:form.id,method:'GET',path:handlerPath('navigation',entry.index),handler:`app${handlerPath('navigation',entry.index)}/route.ts`,access:policy.access,actionIds:actions.filter(id=>project.actions.find(a=>a.id===id)?.operation==='navigate')});
 }
 endpoints.push({id:project.id+':auth',sourceObjectId:login?.id??project.id,method:'POST',path:authPath,handler:`app${authPath}/route.ts`,access:'public',actionIds:project.actions.filter(a=>['login','logout'].includes(a.operation)&&project.forms.find(f=>f.id===a.formId)?.kind==='Login').map(a=>a.id)},{id:project.id+':csrf',sourceObjectId:login?.id??project.id,method:'GET',path:csrfPath,handler:`app${csrfPath}/route.ts`,access:'public',actionIds:[]});
 // Validate once above, then associate its diagnostics (and projection failures)
 // by canonical source. A retained draft edge describes an invalid declaration,
 // not executable typed movement. Other sources remain independently inspectable.
 const diagnosticsBySource=new Map<string,Diagnostic[]>();
 for(const diagnostic of diagnostics){const id=diagnostic.objectId??project.id;const group=diagnosticsBySource.get(id)??[];group.push(diagnostic);diagnosticsBySource.set(id,group);}
 for(const edge of edges){edge.diagnostics=diagnosticsBySource.get(edge.sourceObjectId)??[];edge.valid=!edge.diagnostics.some(d=>d.severity==='error');}
 return {nodes,edges,endpoints,diagnostics};
}
