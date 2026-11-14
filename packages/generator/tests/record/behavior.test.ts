import { expect, test } from 'vitest';
import { parseProject } from '@schema-baron/model';
import { compileProject } from '../../src/index.js';
function recordProject() {
 return parseProject({id:'project',name:'Policy boundaries',formatVersion:1,revision:1,target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'data',locator:{approvedRootId:'data',relativePath:'records.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,opaqueObjects:[],tables:[{id:'source',physicalName:'generic records',columns:[{id:'key',physicalName:'code',type:{kind:'text'},nullable:false},{id:'title',physicalName:'caption',type:{kind:'text'},nullable:false}],primaryKey:['key'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}]},pages:[{id:'page',route:'/record',title:'Record',formIds:['form'],document:[{kind:'form',formId:'form'}]},{id:'list',route:'/list',title:'List',formIds:[],document:[]}],forms:[{id:'form',pageId:'page',kind:'Record',sourceRef:{kind:'table',id:'source'},keyMapping:[{targetFieldId:'key',expression:{kind:'field',alias:'root',fieldId:'key'}}],displayFieldIds:['title'],controlIds:['control'],actionIds:['delete'],search:[],sorting:[],paging:{pageSize:20},appearance:{label:'Record'}}],controls:[{id:'control',formId:'form',kind:'text',binding:{kind:'stored',fieldId:'title'},readOnly:false,validation:{required:true},appearance:{label:'Caption'},events:[]}],actions:[{id:'delete',formId:'form',operation:'delete',success:{pageId:'list',keyMapping:[],filterMapping:[]}}],policies:[{id:'global',scope:'global',ownerId:'project',access:'public'}],globalPolicyId:'global',queries:[],extensionContracts:[],outputConfig:{approvedRootId:'output',relativePath:'app'}});
}
test('a protected action fails closed before emitting any application',()=>{
 const project=recordProject();project.policies.push(parseProject({...project,policies:[...project.policies,{id:'protected-action',scope:'action',ownerId:'delete',access:'authenticated'}]}).policies.at(-1)!);project.actions[0]!.policyId=project.policies.at(-1)!.id;
 expect(()=>compileProject(project)).toThrow('Configure identity before generating authenticated policies');
});
test('delete needs explicit source display fields and a declared successful destination',()=>{
 const project=recordProject();project.forms[0]!.displayFieldIds=[];
 expect(()=>compileProject(project)).toThrow('Select Record name fields');
 project.forms[0]!.displayFieldIds=[project.schema.tables[0]!.columns[1]!.id];delete project.actions[0]!.success;
 expect(()=>compileProject(project)).toThrow('Declare a success destination');
});
test('an incomplete destination key mapping fails before output',()=>{
 const project=recordProject();project.actions[0]!.success={pageId:project.pages[0]!.id,keyMapping:[],filterMapping:[]};
 expect(()=>compileProject(project)).toThrow('Destination must map every ordered Record key');
});
test('declared Record name fields resolve against their own source',()=>{
 const project=recordProject();project.forms[0]!.displayFieldIds=[project.id];
 expect(()=>compileProject(project)).toThrow();
});

test('unsupported form key expressions are diagnosed rather than silently ignored',()=>{
 const project=recordProject();project.forms[0]!.keyMapping[0]!.expression={kind:'literal',value:'fixed',type:{kind:'text'}};
 expect(()=>compileProject(project)).toThrow('Form keys must bind their own stored field');
});
