import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseProject} from '@schema-baron/model';
import {compileProject,emitApplication} from '../../src/index.js';
export function reportProject() {
 const p=JSON.parse(readFileSync('fixtures/queries/project.json','utf8'));
 const query=p.queries.at(-1); const form={id:'summary-form',pageId:'report-page',kind:'Grid',sourceRef:{kind:'query',id:query.id},queryParameters:[],keyMapping:[],controlIds:query.projections.map((f:any)=>'control-'+f.id),actionIds:[],search:[],sorting:[],paging:{pageSize:20},appearance:{label:'Summary'}};
 p.pages=[{id:'report-page',route:'/summary',title:'Summary',formIds:[form.id],document:[{kind:'form',formId:form.id}]}];p.forms=[form];p.controls=query.projections.map((f:any)=>({id:'control-'+f.id,formId:form.id,kind:'label',binding:{kind:'stored',fieldId:f.id},readOnly:true,appearance:{label:f.name},validation:{required:false},events:[]}));p.actions=[];
 p.connections=[{id:'connection',name:'data',locator:{approvedRootId:'data',relativePath:'data.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}];p.connectionRefs=['connection'];return parseProject(p);
}
test('saved aggregate queries emit independent reusable server-only report modules',()=>{
 const p=reportProject();const ir=compileProject(p);const files=emitApplication(ir,'/external/data.sqlite');
 expect(ir.queries.length).toBeGreaterThan(0);
 expect(files.some(f=>f.path==='server/report-0.ts')).toBe(true);
 expect(files.find(f=>f.path==='components/grid-0.tsx')?.content).toContain('No records found');
 expect(files.every(f=>!f.content.includes('@schema-baron/'))).toBe(true);
});
test('runtime and literal inputs are distinct, validated declarations',()=>{
 const p=reportProject(),q=p.queries.at(-1)!;q.parameters.push({id:'threshold',name:'Minimum',type:{kind:'integer'},nullable:false,default:0});
 p.forms[0]!.queryParameters=[{parameterId:'threshold',runtime:{name:'minimum'}}] as any;
 expect(()=>compileProject(p)).not.toThrow();
 (p.forms[0]!.queryParameters![0] as any).value=5;expect(()=>compileProject(p)).toThrow();
});
test('query-source derived expressions compile through the same query graph and remain read-only',()=>{
 const p=reportProject(),q=p.queries.at(-1)!,field=q.projections.find(f=>f.type.kind==='decimal')!;
 const c=p.controls.find(c=>c.binding?.kind==='stored'&&c.binding.fieldId===field.id)!;
 c.binding={kind:'derived',expression:{kind:'binary',operator:'+',left:{kind:'field',alias:'root',fieldId:field.id},right:{kind:'literal',value:'0.1000',type:field.type}},sourceDependencies:[q.id]};
 const ir=compileProject(p);expect(ir.routes[0]!.grids[0]!.controls.find(x=>x.id===c.id)?.fieldId).toBe(c.id);
 expect(ir.queries.at(-1)?.compiled.sql).toContain('sb_add');
 c.binding.expression={kind:'field',alias:'root',fieldId:field.id};expect(()=>compileProject(p)).not.toThrow();
 c.readOnly=false;expect(()=>compileProject(p)).toThrow();c.readOnly=true;c.binding.sourceDependencies=[];expect(()=>compileProject(p)).toThrow();
});
test('required, duplicate and stale runtime inputs fail with actionable declarations',()=>{
 const p=reportProject(),q=p.queries.at(-1)!;q.parameters.push({id:'required',name:'Required',type:{kind:'text'},nullable:true});
 expect(()=>compileProject(p)).toThrow('Bind required query parameter Required');
 p.forms[0]!.queryParameters=[{parameterId:'required',runtime:{name:'lookup'}}];expect(()=>compileProject(p)).not.toThrow();
 q.parameters.push({id:'other-input',name:'Other',type:{kind:'text'},nullable:true,default:null});
 p.forms[0]!.queryParameters.push({parameterId:'other-input',runtime:{name:'lookup'}});expect(()=>compileProject(p)).toThrow();
 p.forms[0]!.queryParameters[1]!.runtime!.name='other';expect(()=>compileProject(p)).not.toThrow();
 p.forms[0]!.queryParameters[1]!.parameterId='removed' as any;expect(()=>compileProject(p)).toThrow();
});
test('reports diagnose unsupported table filters and tightened query action policies before emission',()=>{
 const p=reportProject(),f=p.forms[0]!;f.search=[{fieldId:p.queries.at(-1)!.projections[0]!.id,operator:'eq'}];
 expect(()=>compileProject(p)).toThrow('Use saved-query WHERE/HAVING');f.search=[];
 p.actions.push({id:'locked-link',formId:f.id,operation:'navigate',policyId:'locked-policy',destination:{pageId:f.pageId,keyMapping:[],filterMapping:[]}} as any);f.actionIds=['locked-link'] as any;p.policies.push({id:'locked-policy',scope:'action',ownerId:'locked-link',access:'authenticated'} as any);
 // Identity validation may add an earlier diagnostic; the report-specific refusal must remain.
 let failure:unknown;try{compileProject(p);}catch(error){failure=error;}
 expect(failure).toMatchObject({diagnostics:expect.arrayContaining([expect.objectContaining({objectId:'locked-link',message:expect.stringContaining('Authenticated query navigation or Search requires a proven keyed-query read guard')})])});
});
test('query compiler failures retain actionable query-linked diagnostics',()=>{
 const p=reportProject(),q=p.queries.find(q=>q.joins.length)!;
 q.joins[0]!.cardinality='one-to-one';q.joins[0]!.on={kind:'literal',type:{kind:'boolean'},value:true};
 try{compileProject(p);throw Error('Expected grain refusal.');}catch(error){expect(error).toMatchObject({diagnostics:[{code:'INVALID_QUERY_GRAIN',objectId:q.id,recoveryAction:'Repair this saved query before generating its report.'}]});}
});
test('portable runtime decoder keeps blank text and boolean false distinct and rejects unsafe numeric inputs',async()=>{
 const {queryScalarFile}=await import('../../src/templates/report/runtime-files.js');
 const helper=await import('data:text/javascript;base64,'+Buffer.from(queryScalarFile().content).toString('base64'));
 const input=(kind:string,extra={})=>({type:{kind,...extra},nullable:true});
 expect(helper.parseQueryInput('',input('text'))).toBe('');expect(helper.parseQueryInput('false',input('boolean'))).toBe(false);
 expect(helper.parseQueryInput('7',input('integer'))).toBe(7);expect(()=>helper.parseQueryInput('0x10',input('integer'))).toThrow();expect(()=>helper.parseQueryInput('9007199254740992',input('integer'))).toThrow();
 expect(helper.parseQueryInput('0.1000',input('decimal',{precision:20,scale:4}))).toBe('0.1000');expect(()=>helper.parseQueryInput('0.10000',input('decimal',{precision:20,scale:4}))).toThrow();
});
