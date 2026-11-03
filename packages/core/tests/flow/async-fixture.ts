import {afterEach,vi} from 'vitest';
import {operationResultSchemas} from '@schema-baron/model';
import type {Command,Project} from '@schema-baron/model';
import type {CommandEffect,CommandRegistry} from '../../src/commands/index.js';
// flow.inspect is a real registered operation now. These concurrency tests delay
// the dispatch port rather than claiming a reserved production operation slot.
// Keep canonical result validation and all other dispatch behavior intact.
export function delayFlowDispatch(registry:CommandRegistry,handler:(command:Command,snapshot:Project|undefined)=>Promise<CommandEffect>){
 const isAsync=registry.isAsync.bind(registry),runAsync=registry.runAsync.bind(registry);
 vi.spyOn(registry,'isAsync').mockImplementation(operation=>operation==='flow.inspect'||isAsync(operation));
 vi.spyOn(registry,'runAsync').mockImplementation(async(command,snapshot)=>{if(command.operation!=='flow.inspect')return runAsync(command,snapshot);const effect=await handler(command,snapshot);operationResultSchemas['flow.inspect'].parse(effect.result);return effect;});
}
afterEach(()=>vi.restoreAllMocks());
