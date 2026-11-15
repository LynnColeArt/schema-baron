import {handlerPath} from '../../behavior/index.js';
import type { GeneratedFile, RecordIR } from '../../ir/index.js';
export function recordFiles(record:RecordIR,index:number,flashCookie:string):GeneratedFile[] {
 const config=JSON.stringify(record.config,null,2);
 return [
 {path:`app${handlerPath('record',index)}/image/route.ts`,content:`import {cookies} from 'next/headers';
import {authorize,sessionCookie,failure} from '../../../../server/auth';
import {config} from '../../../../server/record-${index}';
import {readRecordImage} from '../../../../server/record-images';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const jar=await cookies();authorize(config.pageId,undefined,jar.get(sessionCookie)?.value);const params:Record<string,string>={};let field:string|undefined;for(const [key,value]of new URL(request.url).searchParams){if(key==='_field'){if(field!==undefined)throw Error();field=value;}else{if(key in params)throw Error();params[key]=value;}}if(!field)throw Error();const bytes=readRecordImage(config,params,field);return new Response(new Uint8Array(bytes),{headers:{'content-type':'image/webp','x-content-type-options':'nosniff','cache-control':'private, no-store'}});}catch(error){return failure(error);}}
`},
 {path:`app${handlerPath('record',index)}/route.ts`,content:`import { cookies } from 'next/headers';
import { authorize, originCheck, failure, sessionCookie, csrfCookie } from '../../../server/auth';
import { config } from '../../../server/record-${index}';
import { load, execute } from '../../../server/record-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const jar=await cookies();authorize(config.pageId,undefined,jar.get(sessionCookie)?.value);const parameters:Record<string,string>={};for(const [k,v] of new URL(request.url).searchParams){if(k in parameters)throw Error();parameters[k]=v;}return Response.json(load(config,parameters),{headers:{'cache-control':'no-store'}});}catch(error){return failure(error);}}
export async function POST(request:Request){try{const jar=await cookies();originCheck(request.headers.get('origin'),request.headers.get('host'),request.headers.get('x-csrf-token')??undefined,jar.get(csrfCookie)?.value);const body:unknown=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();const b=body as Record<string,unknown>;if(Object.keys(b).some(k=>!['action','parameters','input','confirmed'].includes(k))||typeof b.action!=='string')throw Error();authorize(config.pageId,b.action,jar.get(sessionCookie)?.value);for(const value of [b.parameters,b.input])if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(v=>typeof v!=='string'))throw Error();const result=execute(config,b.action,b.parameters as Record<string,string>,b.input as Record<string,string>,b.confirmed===true);return Response.json(result,{status:result.summary?400:200,headers:{'cache-control':'no-store'}});}catch(error){return failure(error);}}
`},
 {path:`server/record-${index}.ts`,content:`import 'server-only';
import { load } from './record-service.ts';
import type { Parameters } from './record-validation.ts';
export const config = ${config} as const;
export function loadRecord(parameters:Parameters) { return load(config,parameters); }
`},
 {path:`server/record-action-${index}.ts`,content:`'use server';
import { guardAction, AccessError } from './auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { config } from './record-${index}';
import { type State, type Control } from './record-service.ts';
import { executeImages } from './record-images.ts';
import { context, type ContextField } from './navigation';
import type { Field } from './record-validation';
export async function submit${index}(_previous:State, data:FormData):Promise<State> {
 const empty:State={values:{},errors:{},summary:''};
 try {
  const requested=data.get('_action');if(typeof requested!=='string')throw Error();
  await guardAction(config.pageId,requested,data);
  const text=data.get('_parameters'); if(typeof text!=='string'||text.length>20000) throw Error();
  const parameters:unknown=JSON.parse(text);
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters)||Object.values(parameters).some(v=>typeof v!=='string')) throw Error();
  const params=parameters as Record<string,string>;
  const allowed=[...(config.context as readonly ContextField[]).map(c=>c.parameter),...config.keyParameters,config.id+':mode'];
  if(Object.keys(params).some(key=>!allowed.includes(key))) throw Error();
  context(params,config.context);
  const input:Record<string,string>={};const files=new Map<string,File>();
  for(const [key] of data) if(!['_parameters','_action','_confirmed','_csrf'].includes(key)&&!key.startsWith('field:')&&!key.startsWith('$ACTION_')) throw Error();
  for(const [key,value] of data) if(key.startsWith('field:')) {
   const id=key.slice(6);if(id in input||files.has(id))throw Error();
   if(value instanceof File){if(!(config.controls as readonly Control[]).some(c=>c.kind==='image'&&c.fieldId===id))throw Error();files.set(id,value);}
   else {input[id]=value;}
  }
  for(const control of config.controls as readonly Control[]) {
   const field=(config.source.fields as readonly Field[]).find(f=>f.id===control.fieldId);
   if(control.kind==='checkbox'&&field?.type.kind==='boolean'&&!field.nullable&&(!control.readOnly||params[config.id+':mode']==='new'&&(config.source.keys as readonly string[]).includes(field.id))&&!(field.id in input)) input[field.id]='0';
  }
  const action=data.get('_action'); if(typeof action!=='string') throw Error();
  const state=await executeImages(config,action,params,input,files,data.get('_confirmed')==='yes');
  if(state.location) {
   if(state.saved) (await cookies()).set(${JSON.stringify(flashCookie)},'1',{path:'/',sameSite:'lax',maxAge:60});
   redirect(state.location);
  }
  return state;
 } catch(error) {
  if(error&&typeof error==='object'&&'digest' in error) throw error;
  if(error instanceof AccessError) return {...empty,summary:error.message==='CSRF validation failed.'?'Reload this page and sign in again before trying this action.':error.message};
  return {...empty,summary:'The submitted record parameters are invalid.'};
 }
}
`},
 {path:`components/record-${index}.tsx`,content:`'use client';
import { useActionState } from 'react';
import { Csrf } from './csrf';
import { submit${index} } from '../server/record-action-${index}';
import type { State } from '../server/record-service';
type Props={parameters:Record<string,string>;initial:Record<string,string>;isNew:boolean;name:string;impacts:{table:string;rule:string;count:number}[];options:Record<string,{value:string;label:string}[]>};
export function Record${index}({parameters,initial,isNew,name,impacts,options}:Props) {
 const [state,action,pending]=useActionState(submit${index},{values:initial,errors:{},summary:''} as State);
 return <section><h2>{${JSON.stringify(record.label)}}</h2><form action={action} className="record-form">
 <Csrf />
 <input type="hidden" name="_parameters" value={JSON.stringify(parameters)} />
 {state.summary&&<p role="alert">{state.summary}</p>}
 <div className="record-fields">
${record.controls.filter(c=>c.fieldId).map(c=>{
 const field=record.source.fields.find(f=>f.id===c.fieldId)!,id=JSON.stringify(field.id);
 const readOnly=field.generated?'true':c.readOnly?`!isNew || !${JSON.stringify(record.source.keys)}.includes(${id})`:'false';
 const input=c.kind==='image'
  ? `<><input aria-label={${JSON.stringify(c.label)}} type="file" name={'field:'+${id}} accept="image/png,image/jpeg,image/webp" /><small>PNG, JPEG or WebP, up to 5 MiB; saved as metadata-free WebP. Leave empty to keep the image.</small>{!isNew&&initial[${id}]&&<img alt={${JSON.stringify(c.label)}} src={${JSON.stringify(handlerPath('record',index)+'/image')}+'?'+new URLSearchParams({...parameters,_field:${id}}).toString()} style={{maxWidth:240,maxHeight:240}} />}</>`
  : c.lookup
  ? `<select aria-label={${JSON.stringify(c.label)}} name={'field:'+${id}} defaultValue={state.values[${id}]??''}><option value="">Choose a value</option>{options[${id}]?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>`
  : field.type.kind==='boolean'
   ? field.nullable
    ? `<select aria-label={${JSON.stringify(c.label)}} name={'field:'+${id}} defaultValue={state.values[${id}]??''}><option value="">No value</option><option value="0">No</option><option value="1">Yes</option></select>`
    : `<input aria-label={${JSON.stringify(c.label)}} type="checkbox" name={'field:'+${id}} value="1" defaultChecked={state.values[${id}]==='1'} />`
   : `<input aria-label={${JSON.stringify(c.label)}} name={'field:'+${id}} defaultValue={state.values[${id}]??''} type={${JSON.stringify(field.type.kind==='date'?'date':'text')}} />`;
 return ` <label>{${JSON.stringify(c.label)}}
 {${readOnly} ? <output>{initial[${id}]}</output> : ${input}}
 {state.errors[${id}]&&<span role="alert">{state.errors[${id}]}</span>}
 </label>`;
 }).join('\n')}
 </div>
 {!isNew&&<div className="record-delete"><p>Delete {name || 'this record'}?</p>{impacts.map(impact=><p key={impact.table+impact.rule}>{impact.count} related records in {impact.table}: {impact.rule==='CASCADE'?'will be deleted (including their cascading descendants)':impact.rule==='SET NULL'?'their related reference will be cleared':impact.rule==='SET DEFAULT'?'their related reference will use its default':'prevent deletion'}.</p>)}<label><input type="checkbox" name="_confirmed" value="yes" />Confirm deletion of {name || 'this record'}</label></div>}
 <div className="record-actions">
${(record.config.actions as {id:string;operation:string;label?:string}[]).map(a=>` {${a.operation==='insert'?'isNew':a.operation==='update'||a.operation==='delete'?'!isNew':'true'}&&<button name="_action" value={${JSON.stringify(a.id)}} disabled={pending}>{${JSON.stringify(a.label??(a.operation==='insert'||a.operation==='update'?'Save':a.operation==='delete'?'Delete':a.operation==='cancel'?'Cancel':a.operation))}}</button>}`).join('\n')}
 </div>
 </form></section>;
}
`}
 ];
}
