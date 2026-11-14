import {afterEach,expect,it,vi} from 'vitest';
import {initialMapView,restoreMapView,retainMapView,retainNodeMeasurements} from './state.js';
afterEach(()=>vi.unstubAllGlobals());
it('bounds damaged view recovery and keeps it outside semantic model/draft persistence',()=>{const data=new Map<string,string>();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});const view=initialMapView();view.positions['node']={x:22,y:-15};view.selection='edge:destination';expect(retainMapView('project',view)).toBe(true);expect(restoreMapView('project')).toEqual(view);expect([...data.keys()]).toEqual(['studio.flow.view.project']);data.set('studio.flow.view.project',JSON.stringify({positions:{node:{x:'invalid',y:1}},viewport:{x:0,y:0,zoom:1000},query:'x'.repeat(300)}));expect(restoreMapView('project')).toEqual(initialMapView());data.set('studio.flow.view.project','broken JSON');expect(restoreMapView('project')).toEqual(initialMapView());});
it('reports unavailable map storage instead of changing canonical drafts',()=>{vi.stubGlobal('sessionStorage',{getItem(){throw Error('storage unavailable');},setItem(){throw Error('storage unavailable');}});expect(restoreMapView('project')).toEqual(initialMapView());expect(retainMapView('project',initialMapView())).toBe(false);});

it('retains controlled dimensions across stable-ID projection replacement without changing model/view state',()=>{
 const view=initialMapView(),before=structuredClone(view);const measured=retainNodeMeasurements({},[{id:'page',dimensions:{width:210,height:85}},{id:'action',dimensions:{width:210,height:70}}]);
 const project=[{id:'page',label:'Old title'},{id:'action',label:'Save'}];const replaced=project.map(node=>({...node,label:node.label+' saved',measured:measured[node.id]}));
 expect(replaced.map(node=>node.measured)).toEqual([{width:210,height:85},{width:210,height:70}]);expect(view).toEqual(before);
 expect(retainNodeMeasurements(measured,[{id:'page',dimensions:{width:210,height:85}}])).toBe(measured);
 expect(retainNodeMeasurements(measured,[{id:'page',dimensions:{width:0,height:85}},{id:'action',dimensions:{width:NaN,height:70}}])).toBe(measured);
 const resized=retainNodeMeasurements(measured,[{id:'page',dimensions:{width:240,height:110}}]);expect(resized.page).toEqual({width:240,height:110});expect(measured.page).toEqual({width:210,height:85});
});
