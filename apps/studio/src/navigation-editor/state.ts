import {navigationMenuSchema,navigationMenuDiagnostics} from '@schema-baron/model';
import type {NavigationMenu} from '@schema-baron/model';
export type Entry=NavigationMenu['entries'][number];
/** Reorders raw drafts without requiring partially edited labels to validate. */
export function moveBefore(entries:readonly Entry[],source:string,target:string):Entry[]{
 const from=entries.findIndex(e=>e.id===source),to=entries.findIndex(e=>e.id===target);
 if(from<0||to<0||from===to)return [...entries];
 const next=entries.filter(e=>e.id!==source);next.splice(next.findIndex(e=>e.id===target),0,entries[from]!);return next;
}
export function step(entries:readonly Entry[],id:string,direction:-1|1):Entry[]{
 const next=[...entries],index=next.findIndex(e=>e.id===id),target=index+direction;
 if(index>=0&&target>=0&&target<next.length)[next[index],next[target]]=[next[target]!,next[index]!];return next;
}
export function validateDraft(entries:readonly Entry[],pages:readonly {id:string}[]):string{
 const parsed=navigationMenuSchema.safeParse({entries});
 if(!parsed.success)return parsed.error.issues.map(i=>i.message).join(' ');
 return navigationMenuDiagnostics(parsed.data,pages).map(d=>d.message).join(' ');
}
/** Draft-only edits retain identity/type; shared validation gates persistence. */
export function editExternal(entries:readonly Entry[],id:string,patch:{url?:string;visibility?:'public'|'authenticated'}):Entry[]{
 return entries.map(entry=>entry.id===id&&entry.kind==='external'?{...entry,...(patch.url===undefined?{}:{url:patch.url}),...(patch.visibility===undefined?{}:{visibility:patch.visibility})}:entry);
}
export function moveAnnouncement(before:readonly Entry[],after:readonly Entry[],id:string):string|null{
 const previous=before.findIndex(entry=>entry.id===id),position=after.findIndex(entry=>entry.id===id);
 if(previous<0||position<0||previous===position)return null;
 return `Moved ${after[position]!.label.trim()||'unnamed entry'} to position ${position+1} of ${after.length}. Unsaved navigation changes.`;
}
