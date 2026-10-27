import { describe, expect, it } from 'vitest';
import { policyOperations } from './state.js';
import { createId, effectiveAccess } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
describe('security policy editing',()=>{
 const id=createId;const project={id:id(),globalPolicyId:id(),pages:[{id:id(),title:'Public',route:'/',document:[],formIds:[]}],actions:[],policies:[]} as unknown as Project;
 project.policies=[{id:project.globalPolicyId,ownerId:project.id,scope:'global',access:'authenticated'}];
 it('authors explicit public page override and reports its source',()=>{const ops=policyOperations(project,'page',project.pages[0]!.id,'public');expect(ops.map(o=>o.entity)).toEqual(['policy','page']);const policy=ops[0]!.value as Project['policies'][number];const page=ops[1]!.value as Project['pages'][number];const next={...project,pages:[page],policies:[...project.policies,policy]};expect(effectiveAccess(next,page.id)).toEqual({access:'public',sourcePolicyId:policy.id});});
 it('does not allow an action to weaken access',()=>{expect(()=>policyOperations(project,'action',id(),'public')).toThrow('inherit or require');});
});
