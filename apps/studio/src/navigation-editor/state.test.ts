import {expect,test} from 'vitest';
import {navigationMenuSchema} from '@schema-baron/model';
import {moveBefore,step,validateDraft,editExternal,moveAnnouncement} from './state.js';
const entries=()=>navigationMenuSchema.parse({entries:[{id:'a',kind:'page',pageId:'home',label:'Home'},{id:'b',kind:'external',label:'Help',url:'https://example.invalid/help'},{id:'c',kind:'page',pageId:'other',label:'Other'}]}).entries;
test('drag and keyboard move preserve identity and immutable draft even during invalid rename',()=>{const source=entries();source[0]!.label='';expect(moveBefore(source,'c','b').map(e=>e.id)).toEqual(['a','c','b']);expect(step(source,'c',-1)).toEqual(moveBefore(source,'c','b'));expect(source.map(e=>e.id)).toEqual(['a','b','c']);expect(step(source,'a',-1)).toEqual(source);expect(moveBefore(source,'missing','a')).toEqual(source);});
test('saved model constraints reject bad URLs names and missing destination',()=>{const source=entries();expect(validateDraft(source,[{id:'home'},{id:'other'}])).toBe('');expect(validateDraft(source,[{id:'home'}])).toContain('missing');source[0]!.label='<b>bad</b>';expect(validateDraft(source,[{id:'home'},{id:'other'}])).not.toBe('');const external=entries()[1]!;if(external.kind==='external')external.url='javascript:alert(1)';expect(validateDraft([external],[])).not.toBe('');});
test('empty list is explicit and external links default authenticated',()=>{expect(validateDraft([],[])).toBe('');expect(entries()[1]).toMatchObject({visibility:'authenticated'});});

test('existing external URL and visibility edits retain ID and validate before save',()=>{
 const original=entries(),edited=editExternal(original,'b',{url:'https://docs.example.com/guide',visibility:'public'});
 expect(edited[1]).toEqual({...original[1],url:'https://docs.example.com/guide',visibility:'public'});
 expect(original[1]).toMatchObject({url:'https://example.invalid/help',visibility:'authenticated'});
 expect(edited[0]).toEqual(original[0]);expect(validateDraft(edited,[{id:'home'},{id:'other'}])).toBe('');
 const invalid=editExternal(edited,'b',{url:'javascript:alert(1)'});expect(invalid[1]).toMatchObject({id:'b',url:'javascript:alert(1)'});expect(validateDraft(invalid,[{id:'home'},{id:'other'}])).not.toBe('');
 expect(editExternal(edited,'b',{visibility:'authenticated'})[1]).toMatchObject({id:'b',visibility:'authenticated'});
 expect(editExternal(original,'a',{url:'https://example.com',visibility:'public'})).toEqual(original);
 expect(editExternal(original,'missing',{url:'https://example.com'})).toEqual(original);
});
test('keyboard and drop announce exact moved label and one-based position; no-op is silent',()=>{
 const original=entries();expect(moveAnnouncement(original,step(original,'c',-1),'c')).toBe('Moved Other to position 2 of 3. Unsaved navigation changes.');
 expect(moveAnnouncement(original,moveBefore(original,'c','b'),'c')).toBe(moveAnnouncement(original,step(original,'c',-1),'c'));
 expect(moveAnnouncement(original,step(original,'a',-1),'a')).toBeNull();expect(moveAnnouncement(original,original,'missing')).toBeNull();
 original[2]!.label='';expect(moveAnnouncement(original,step(original,'c',-1),'c')).toBe('Moved unnamed entry to position 2 of 3. Unsaved navigation changes.');
});
