'use client';
import {useRef,useState} from 'react';
import {createId} from '@schema-baron/model';
import type {Project,StableId} from '@schema-baron/model';
import type {StudioClient} from '../project-ui/api.js';
import {saveNavigation} from './save.js';
import {moveBefore,step,validateDraft,editExternal,moveAnnouncement} from './state.js';
import type {Entry} from './state.js';
/** Host must guard dismissal while onDirty(true); no hover/drop persistence. */
export function NavigationEditor({project,client,onChanged,onBusy,onDirty}:{project:Project;client:StudioClient;onChanged:(p:Project)=>void;onBusy:(busy:boolean)=>void;onDirty:(dirty:boolean)=>void}){
 const [baseline,setBaseline]=useState(project),[entries,setEntries]=useState<Entry[]>(()=>structuredClone(project.navigation?.entries??[]));
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[reloadRequired,setReloadRequired]=useState(false);
 const [pageId,setPageId]=useState(project.pages[0]?.id??''),[label,setLabel]=useState(''),[url,setUrl]=useState('');
 const addPageButton=useRef<HTMLButtonElement>(null);
 const drag=useRef<string|null>(null),fields=useRef(new Map<string,HTMLInputElement>());
 const validation=validateDraft(entries,project.pages),stale=project.revision!==baseline.revision;
 function change(next:Entry[],focus?:string|null){
  setEntries(next);setDirty(true);onDirty(true);setStatus('Unsaved navigation changes.');
  if(focus===undefined)return;
  const priorFocus=document.activeElement;
  requestAnimationFrame(()=>{
   // A later user interaction takes precedence over delayed insertion/reorder focus.
   if(document.activeElement!==priorFocus&&document.activeElement!==document.body)return;
   if(focus)fields.current.get(focus)?.focus();else addPageButton.current?.focus();
  });
 }
 function reorder(next:Entry[],id:string){const announcement=moveAnnouncement(entries,next,id);if(!announcement)return;change(next,id);setStatus(announcement);}
 function rename(id:string,value:string){change(entries.map(e=>e.id===id?{...e,label:value}:e));}
 async function reload(){setBusy(true);onBusy(true);setError('');try{const fresh=await client.snapshot(project.id);setBaseline(fresh);setEntries(structuredClone(fresh.navigation?.entries??[]));setDirty(false);onDirty(false);setReloadRequired(false);onChanged(fresh);setStatus('Latest saved navigation loaded. Draft discarded.');}catch(e){setError(e instanceof Error?e.message:'Reload failed. Draft retained.');}finally{setBusy(false);onBusy(false);}}
 async function save(){if(validation||stale||reloadRequired||!dirty)return;setBusy(true);onBusy(true);setError('');setStatus('');try{const fresh=await saveNavigation(client,baseline,{entries});setBaseline(fresh);setEntries(structuredClone(fresh.navigation?.entries??[]));setDirty(false);onDirty(false);setReloadRequired(false);onChanged(fresh);setStatus('Navigation saved.');}catch(e){setReloadRequired(true);setError((e instanceof Error?e.message:'Save failed.')+' Draft retained. Reload saved navigation before resolving a conflict or uncertain result.');}finally{setBusy(false);onBusy(false);}}
 return <section aria-label="Generated application navigation"><h3>Application navigation</h3><p>Ordered links for the generated application. Page permissions still apply. Custom links require sign-in by default. Changes are saved only with Save navigation.</p>
 <fieldset disabled={busy||reloadRequired}><legend>Add existing page</legend><label>Destination page<select value={pageId} onChange={e=>setPageId(e.target.value as StableId)}>{project.pages.map(p=><option key={p.id} value={p.id}>{p.title} · {p.route}</option>)}</select></label><button ref={addPageButton} type="button" disabled={!pageId||entries.length>=200} onClick={()=>{const page=project.pages.find(p=>p.id===pageId);if(page){const id=createId();change([...entries,{id,kind:'page',pageId:page.id,label:page.title}],id);}}}>Add page</button></fieldset>
 <fieldset disabled={busy||reloadRequired}><legend>Add HTTPS link</legend><label>Link label<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>HTTPS address<input type="url" value={url} onChange={e=>setUrl(e.target.value)}/></label><button type="button" disabled={!label||!url||entries.length>=200} onClick={()=>{const entry:Entry={id:createId(),kind:'external',label,url,visibility:'authenticated'};const issue=validateDraft([entry],project.pages);if(issue){setError(issue);return;}change([...entries,entry],entry.id);setLabel('');setUrl('');setError('');}}>Add HTTPS link</button></fieldset>
 <p>Drag an entry onto another to place it before that entry, or use Move up/down.</p><ol aria-label="Navigation entries">{entries.map((entry,index)=><li key={entry.id} onDragOver={e=>{if(!busy&&!reloadRequired&&drag.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(busy||reloadRequired||!drag.current)return;const id=drag.current;drag.current=null;reorder(moveBefore(entries,id,entry.id),id);}}>
 <button type="button" draggable={!busy&&!reloadRequired} disabled={busy||reloadRequired} aria-label={`Drag ${entry.label||'unnamed entry'}`} onDragStart={e=>{drag.current=entry.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',entry.id);}} onDragEnd={()=>{drag.current=null;}}>↕</button>
 <label>Entry {index+1} label<input ref={node=>{if(node)fields.current.set(entry.id,node);else fields.current.delete(entry.id);}} value={entry.label} disabled={busy||reloadRequired} onChange={e=>rename(entry.id,e.target.value)}/></label><p>{entry.kind==='page'?(project.pages.find(p=>p.id===entry.pageId)?.title??'Missing page'):entry.url}</p>
 {entry.kind==='external'&&<fieldset disabled={busy||reloadRequired}><legend>Custom link {index+1}</legend><label>Entry {index+1} HTTPS address<input type="url" value={entry.url} onChange={event=>change(editExternal(entries,entry.id,{url:event.target.value}))}/></label><label>Entry {index+1} visibility<select aria-label={`Entry ${index+1} visibility`} value={entry.visibility} onChange={event=>change(editExternal(entries,entry.id,{visibility:event.target.value as 'public'|'authenticated'}))}><option value="authenticated">Signed-in visitors only</option><option value="public">Public (including signed-out visitors)</option></select></label><p>This controls whether the link is shown, not access to the external website.</p></fieldset>}
 <button type="button" disabled={busy||reloadRequired||index===0} onClick={()=>reorder(step(entries,entry.id,-1),entry.id)}>Move up</button><button type="button" disabled={busy||reloadRequired||index===entries.length-1} onClick={()=>reorder(step(entries,entry.id,1),entry.id)}>Move down</button><button type="button" disabled={busy||reloadRequired} onClick={()=>change(entries.filter(e=>e.id!==entry.id),entries[index+1]?.id??entries[index-1]?.id??null)}>Remove entry</button></li>)}</ol>
 {validation&&<p role="alert">{validation}</p>}{stale&&<p role="alert">Project revision changed. Your navigation draft is retained; reload saved navigation before editing against the new revision.</p>}{error&&<p role="alert">{error}</p>}<p role="status">{status||(dirty?'Unsaved navigation changes.':'No unsaved navigation changes.')}</p>
 <button type="button" disabled={busy||!dirty||!!validation||stale||reloadRequired} onClick={()=>void save()}>Save navigation</button><button type="button" disabled={busy} onClick={()=>void reload()}>Discard draft and reload saved navigation</button>
 </section>;
}
