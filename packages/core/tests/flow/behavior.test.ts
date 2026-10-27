import {describe,it,expect} from 'vitest';
import {createId,parseProject} from '@schema-baron/model';
import {projectBehavior} from '../../src/flow/index.js';
export function fixture(count=1){return parseProject({id:'app',formatVersion:1,revision:1,name:'Behavior',target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:[],connections:[],schema:{id:'schema',revision:1,tables:[],opaqueObjects:[]},queries:[],pages:Array.from({length:count},(_,i)=>({id:'page-'+i,title:'Page '+i,route:'/page-'+i,document:[],formIds:[]})),forms:[],controls:[],actions:[],policies:[{id:'public',ownerId:'app',scope:'global',access:'public'}],globalPolicyId:'public',outputConfig:{approvedRootId:'output',relativePath:'app'},extensionContracts:[]});}
describe('canonical behavior projection',()=>{
 it('keeps source IDs through twenty edits across a hundred nodes',()=>{const p=fixture(100);const selected=p.pages[49]!.id;for(let i=0;i<20;i++){p.pages[i]!.title+=' edit';const graph=projectBehavior(p);expect(graph.nodes).toHaveLength(100);expect(graph.nodes.find(n=>n.id===selected)?.sourceObjectId).toBe(selected);}});
 it('diagnoses a broken draft destination on its action without throwing or mutating',()=>{const p=fixture();p.forms.push({id:createId(()=> 'form'),pageId:p.pages[0]!.id,kind:'Grid',controlIds:[],actionIds:[createId(()=> 'action')],keyMapping:[],search:[],sorting:[],paging:{pageSize:20},appearance:{}});p.pages[0]!.formIds.push(p.forms[0]!.id);p.actions.push({id:createId(()=> 'action'),formId:p.forms[0]!.id,operation:'navigate',destination:{pageId:createId(()=> 'missing'),keyMapping:[],filterMapping:[]}});const before=JSON.stringify(p);const graph=projectBehavior(p);expect(graph.diagnostics.some(d=>d.objectId==='action'&&d.code==='BROKEN_REFERENCE')).toBe(true);expect(JSON.stringify(p)).toBe(before);expect(graph.nodes.some(n=>n.id==='action')).toBe(true);});
});

import {behaviorFixture} from './fixture.js';
import {compileProject,emitApplication} from '@schema-baron/generator';
import {flowProjectionSchema} from '@schema-baron/model';
import {filteredGraph,initialMapView} from '../../../../apps/studio/src/flow-map/state.js';
it('shares emitted handler paths, typed navigation and dynamic login return scopes',()=>{
 const p=behaviorFixture(),graph=projectBehavior(p),ir=compileProject(p),files=emitApplication(ir,'/external/data.sqlite');
 expect(flowProjectionSchema.safeParse(graph).success).toBe(true);
 for(const endpoint of graph.endpoints)expect(files.some(f=>f.path===endpoint.handler),endpoint.handler).toBe(true);
 const edge=graph.edges.find(e=>e.id==='open:destination')!;
 expect(edge.mappings).toEqual(ir.routes[0]!.grids[0]!.actions![0]!.destination!.mappings);
 expect(edge.mappings[0]).toMatchObject({parameter:'record:key:key',field:{type:{kind:'integer'}}});
 expect(graph.edges.find(e=>e.id==='edit:return')?.context).toEqual(expect.arrayContaining([expect.objectContaining({parameter:'record:key:key',field:expect.objectContaining({type:{kind:'integer'}})}),expect.objectContaining({parameter:'grid:filter:name',kind:'search'})]));
 expect(graph.edges.find(e=>e.id==='save:session')?.label).toContain('denied');expect(graph.edges.some(e=>e.id==='save:gate')).toBe(false);
 expect(graph.edges.find(e=>e.id==='cancel:cancel')?.toId).toBe('list');
 expect(graph.edges.find(e=>e.id==='back:destination')?.toId).toBe('list');
});
it('uses the generator page form ordering for handler indices rather than collection order',()=>{const p=behaviorFixture();p.forms.reverse();const graph=projectBehavior(p);const files=emitApplication(compileProject(p),'/external/data.sqlite');for(const e of graph.endpoints)expect(files.some(f=>f.path===e.handler)).toBe(true);expect(graph.endpoints.find(e=>e.sourceObjectId==='record'&&e.method==='POST')?.path).toBe('/runtime/record-1');});
it('keeps source-linked diagnostics for invalid parameter mappings and protected Login Cancel',()=>{const p=behaviorFixture();p.actions.find(a=>a.id==='open')!.destination!.keyMapping[0]!.targetFieldId=createId(()=> 'missing');p.actions.find(a=>a.id==='back')!.destination!.pageId=createId(()=> 'edit');const graph=projectBehavior(p);expect(graph.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({objectId:'open'}),expect.objectContaining({objectId:'back',code:'ACCESS_DENIED'})]));expect(graph.edges.some(e=>e.id==='open:destination')).toBe(false);});
it('filters navigation and focused neighbors without modifying graph/source objects',()=>{const p=behaviorFixture(),graph=projectBehavior(p),before=JSON.stringify(p);const view={...initialMapView(),query:'record:key:key'};expect(filteredGraph(graph,view).edges.some(e=>e.id==='open:destination')).toBe(true);expect(filteredGraph(graph,{...view,query:'',selection:'edit',focus:true}).nodes.every(n=>['edit','record','open','credentials','login','save','cancel'].includes(n.id))).toBe(true);expect(JSON.stringify(p)).toBe(before);});

it.each([
 {name:'missing source field',expression:{kind:'field',alias:'root',fieldId:'gone'},code:'BROKEN_REFERENCE'},
 {name:'missing parameter',expression:{kind:'parameter',parameterId:'gone'},code:'BROKEN_REFERENCE'},
 {name:'incompatible literal type',expression:{kind:'literal',type:{kind:'text'},value:'not-an-integer'},code:'TYPE_MISMATCH'},
] as const)('marks $name on the stable edge and clears it only after canonical repair',({expression,code})=>{
 const p=behaviorFixture(),action=p.actions.find(a=>a.id==='open')!,mapping=action.destination!.keyMapping[0]!,original=structuredClone(mapping.expression);
 mapping.expression=expression as typeof mapping.expression;
 const before=JSON.stringify(p),graph=projectBehavior(p),edge=graph.edges.find(e=>e.id==='open:destination')!;
 expect(()=>compileProject(p)).toThrow();
 expect(edge).toMatchObject({valid:false,sourceObjectId:action.id,fromId:action.id,toId:'edit',diagnostics:expect.arrayContaining([expect.objectContaining({code,objectId:action.id})])});
 expect(graph.nodes).toHaveLength(projectBehavior(behaviorFixture()).nodes.length);
 expect(graph.edges.find(e=>e.id==='save:success')).toMatchObject({valid:true,diagnostics:[]});
 expect(flowProjectionSchema.safeParse(graph).success).toBe(true);
 expect(JSON.stringify(p)).toBe(before);
 mapping.expression=original;
 expect(projectBehavior(p).edges.find(e=>e.id===edge.id)).toMatchObject({valid:true,diagnostics:[],mappings:compileProject(p).routes[0]!.grids[0]!.actions![0]!.destination!.mappings});
});
