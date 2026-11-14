import {ExpressionEditor} from '../query-designer/expression.js';
import type {Control,Form,Project,Query} from '@schema-baron/model';
export function DerivedBinding({project,form,control,onChange}:{project:Project;form:Form;control:Control;onChange:(c:Control)=>void}){
 if(form.sourceRef?.kind!=='query')return null;
 const source=project.queries.find(q=>q.id===form.sourceRef!.id);if(!source)return null;
 const binding=control.binding;
 const query:Query={...source,sources:[{alias:'root',source:form.sourceRef}],joins:[],parameters:[]};
 return <fieldset><legend>Read-only query-derived value</legend>
 {binding?.kind!=='derived'?<button type="button" onClick={()=>onChange({...control,readOnly:true,binding:{kind:'derived',expression:{kind:'field',alias:'root',fieldId:source.projections[0]!.id},sourceDependencies:[source.id]}})}>Use derived query expression</button>:<>
 <ExpressionEditor project={project} query={query} value={binding.expression} label="Derived expression" onChange={expression=>onChange({...control,readOnly:true,binding:{...binding,expression}})} />
 <p>Child aggregates belong to the saved query. This value is computed from that query’s result and cannot be submitted as stored input.</p>
 <fieldset><legend>Source dependencies</legend>{[...project.queries.map(q=>({id:q.id,name:q.name})),...project.schema.tables.map(t=>({id:t.id,name:t.physicalName}))].map(source=><label key={source.id}><input type="checkbox" checked={binding.sourceDependencies.includes(source.id)} onChange={event=>onChange({...control,binding:{...binding,sourceDependencies:event.target.checked?[...binding.sourceDependencies,source.id]:binding.sourceDependencies.filter(id=>id!==source.id)}})} />{source.name}</label>)}</fieldset>
 </>}
 </fieldset>;
}
