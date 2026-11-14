import {readFileSync,writeFileSync} from 'node:fs';
import {compileProject,emitApplication} from '@schema-baron/generator';
// Read-only retained UI-authored model; mutations exist solely in memory to probe compilation.
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
const p=structuredClone(input),record=p.forms.find(f=>f.kind==='Record');
const action=p.actions.find(a=>a.formId===record.id&&a.operation==='update');
const control=p.controls.find(c=>c.formId===record.id&&c.events.some(e=>e.actionId===action.id));
control.appearance.label='Store manuscript';
const ir=compileProject(p),files=emitApplication(ir,'/private/read-only-oracle.sqlite');
const recordIR=ir.routes.flatMap(r=>r.records).find(r=>r.id===record.id);
const labeledSource=files.filter(f=>f.content.includes('Store manuscript')).map(f=>f.path);
const componentFilesWithCaption=files.filter(f=>f.path.startsWith('components/')&&f.content.includes('Store manuscript')).map(f=>f.path);
const label={componentFilesWithCaption,requested:control.appearance.label,actionLabel:recordIR.config.actions.find(a=>a.id===action.id).label??null,emittedFiles:labeledSource};
control.events[0].event='change';
let change;try{const next=compileProject(p);change={accepted:true,events:next.routes.flatMap(r=>r.records).find(r=>r.id===record.id).controls.find(c=>c.id===control.id).events,diagnostics:[]};}catch(e){change={accepted:false,diagnostics:e.diagnostics};}
const result={label,change};writeFileSync(new URL(process.argv[3]??'output-fidelity-observation.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
