import { ModelValidationError, parseProject } from '@schema-baron/model';
import type { Diagnostic, Project } from '@schema-baron/model';
import type { GenerationIR, RouteIR, SourceIR } from '../ir/index.js';
export class GenerationError extends Error { constructor(readonly diagnostics:Diagnostic[]) { super(diagnostics[0]?.message ?? 'Generation failed.'); } }
export function compileProject(input:Project):GenerationIR {
 let project:Project; try { project=parseProject(input); } catch(error) { if(error instanceof ModelValidationError) throw new GenerationError(error.diagnostics); throw error; }
 const diagnostics:Diagnostic[]=[];
 const fail=(objectId:string,message:string)=>diagnostics.push({code:'UNSUPPORTED_SCHEMA_OBJECT',severity:'error',objectId:objectId as Project['id'],message,recoveryAction:'Remove this feature from the output project or wait for its generator capability.'});
 if(project.connections.length!==1) fail(project.id,'Public Grid generation requires one bound SQLite connection.');
 for(const query of project.queries) fail(query.id,'Saved query generation is not available yet.');
 if(project.identity) fail(project.id,'Identity generation is not available yet.');
 for(const extension of project.extensionContracts) fail(extension.id,'Extension ownership requires the regeneration capability.');
 for(const action of project.actions) fail(action.id,'Action and navigation generation is not available yet.');
 const sources:SourceIR[]=project.schema.tables.map(t=>({id:t.id,kind:'table',name:t.physicalName,fields:t.columns.map(c=>({id:c.id,name:c.physicalName,type:c.type,nullable:c.nullable})),keys:t.primaryKey}));
 const routes:RouteIR[]=project.pages.map(page=>{
  if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(page.route) || page.route.endsWith('/')&&page.route!=='/') fail(page.id,'Use a static internal route made of letters, digits, underscores and hyphens.');
  const global=project.policies.find(p=>p.id===project.globalPolicyId)!;const local=project.policies.find(p=>p.id===page.policyId);const effective=local&&local.access!=='inherit'?local:global;
  if(effective.access!=='public') fail(page.id,'Authenticated page generation is not available yet.');
  const grids=page.formIds.flatMap(id=>{
   const form=project.forms.find(f=>f.id===id)!;const source=sources.find(s=>s.id===form.sourceRef?.id&&form.sourceRef.kind==='table');
   if(form.kind!=='Grid'||!source) {fail(form.id,'Only table-bound public Grid forms can be generated in this slice.');return [];}
   for(const sorting of form.sorting){const field=source.fields.find(f=>f.id===sorting.fieldId);if(field?.type.kind==='decimal'&&field.type.encoding==='text') fail(form.id,'Exact decimal text sorting is unavailable in this output slice.');}
   if(form.keyMapping.length) fail(form.id,'Bound key parameters require navigation generation; key mappings cannot be silently ignored.');
   if(!form.controlIds.length) fail(form.id,'Select at least one Grid display control before generation.');
   const controls=form.controlIds.map(id=>{
    const c=project.controls.find(c=>c.id===id)!;
    if(!['label','text','number','date','checkbox'].includes(c.kind)||c.lookup||c.events.length||c.binding?.kind==='derived') fail(c.id,'This control requires a generator capability that is not available yet.');
    if(c.appearance.className||c.appearance.width) fail(c.id,'Custom control layout generation is not available yet.');
    return {id:c.id,kind:c.kind,...(c.binding?.kind==='stored'?{fieldId:c.binding.fieldId}:{}),label:c.appearance.label??(c.binding?.kind==='stored'?source.fields.find(f=>c.binding?.kind==='stored'&&f.id===c.binding.fieldId)?.name:undefined)??c.kind,format:c.appearance.format??'plain' as const};
   });
   if(!controls.some(c=>c.fieldId)) fail(form.id,'Bind at least one Grid display control to a stored field.');
   if(form.appearance.className||form.appearance.width||form.appearance.format) fail(form.id,'Custom Grid layout/format generation is not available yet.');
   return [{id:form.id,label:form.appearance.label??'Records',source,controls,keyMapping:form.keyMapping,search:form.search,sorting:form.sorting,pageSize:form.paging.pageSize}];
  });
  return {id:page.id,path:page.route,title:page.title,document:page.document,grids,policy:{access:'public' as const,sourceId:effective.id}};
 });
 if(!routes.length) fail(project.id,'Create a page and table-bound Grid before generating.');
 if(diagnostics.length) throw new GenerationError(diagnostics);
 return {projectId:project.id,revision:project.revision,name:project.name,routes,sources,queries:[]};
}
