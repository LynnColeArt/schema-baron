import {queryInputs} from '@schema-baron/model';
import type { Action, Expression, Form, Project } from '@schema-baron/model';
import type { ContextIR, DestinationIR, NavigationExpressionIR, SourceIR } from '../../ir/index.js';
export function contextFields(project:Project,sources:SourceIR[]):ContextIR[] {
 return project.forms.filter(f=>f.kind==='Grid'||f.kind==='Search').flatMap(form=>{
  const source=sources.find(s=>s.id===form.sourceRef?.id); if(!source) return [];
  return [...(form.queryParameters??[]).flatMap(m=>{if(!m.runtime)return [];const p=queryInputs(project,source.id).find(p=>p.id===m.parameterId);return p?[{parameter:form.id+':parameter:'+m.runtime.name,kind:'query' as const,field:{id:p.id,name:p.name,type:p.type,nullable:p.nullable}},{parameter:form.id+':parameter:'+m.runtime.name+':mode',kind:'mode' as const}]:[];}),{parameter:form.id+':page',kind:'page'},{parameter:form.id+':sort',kind:'sort',allowed:[...new Set([...project.controls.filter(c=>form.controlIds.includes(c.id)).flatMap(c=>c.binding?.kind==='stored'?[c.binding.fieldId]:[]),...form.sorting.map(s=>s.fieldId)])]},{parameter:form.id+':direction',kind:'direction'},...form.keyMapping.map(k=>({parameter:keyParameter(form,k.targetFieldId),kind:'key' as const,field:source.fields.find(f=>f.id===k.targetFieldId)!})),...form.search.map(s=>({parameter:form.id+':filter:'+s.fieldId,kind:'search' as const,field:source.fields.find(f=>f.id===s.fieldId)!}))];
 });
}
export function keyParameter(form:{id:string;keyMapping:Form['keyMapping']},fieldId:string) {
 const expression=form.keyMapping.find(k=>k.targetFieldId===fieldId)?.expression;
 return expression?.kind==='parameter'?expression.parameterId:form.id+':key:'+fieldId;
}
export function compileDestination(project:Project,sources:SourceIR[],destination:NonNullable<Action['destination']>,operation:string):DestinationIR {
 const page=project.pages.find(p=>p.id===destination.pageId)!;
 const forms=project.forms.filter(f=>f.pageId===page.id);
 const expression=(expr:Expression):NavigationExpressionIR=>{if(expr.kind==='literal')return {kind:expr.kind,value:expr.value};if(expr.kind==='field'&&expr.alias==='root')return {kind:expr.kind,fieldId:expr.fieldId};if(expr.kind==='parameter')return expr;throw Error('Navigation supports declared root fields, typed parameters and literals.');};
 const mappings=[...destination.keyMapping.map(k=>({...k,key:true})),...destination.filterMapping.map(k=>({...k,key:false}))].map(mapping=>{
  const targets=forms.filter(f=>{const source=sources.find(s=>s.id===f.sourceRef?.id);return source?.fields.some(field=>field.id===mapping.targetFieldId)&&(mapping.key?f.kind==='Record':(f.search.some(s=>s.fieldId===mapping.targetFieldId)||f.keyMapping.some(k=>k.targetFieldId===mapping.targetFieldId)));});
  if(targets.length!==1) throw Error('Destination mapping must identify one declared Record key or searchable field.');
  const form=targets[0]!,source=sources.find(s=>s.id===form.sourceRef?.id)!;
  return {parameter:mapping.key?keyParameter(form,mapping.targetFieldId):form.keyMapping.some(k=>k.targetFieldId===mapping.targetFieldId)?keyParameter(form,mapping.targetFieldId):form.id+':filter:'+mapping.targetFieldId,field:source.fields.find(f=>f.id===mapping.targetFieldId)!,expression:expression(mapping.expression)};
 });
 const newForms=forms.filter(f=>f.kind==='Record'&&!destination.keyMapping.length&&operation==='navigate').map(f=>f.id);
 for(const form of forms.filter(f=>f.kind==='Record'&&!newForms.includes(f.id))) {
  const keys=sources.find(s=>s.id===form.sourceRef?.id)?.keys??[];
  if(keys.some(id=>!destination.keyMapping.some(k=>k.targetFieldId===id))) throw Error('Destination must map every ordered Record key.');
 }
 return {path:page.route,mappings,newForms};
}
