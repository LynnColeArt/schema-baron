import { commandSchema, operationResultSchemas } from '@schema-baron/model';
import type { Command, Job, Operation, Project } from '@schema-baron/model';
export interface CommandEffect { result: unknown; candidate?: Project; root?: string; changedIds?: string[]; job?: Job }
export type CommandHandler = (command: Command, snapshot: Project | undefined) => CommandEffect;
/** Input and result validators come exclusively from the canonical model package. */
export class CommandRegistry {
 private asyncHandlers = new Map<Operation, (command: Command, snapshot?: Project) => Promise<CommandEffect>>();
 registerAsync(operation: Operation, handler: (command: Command, snapshot?: Project) => Promise<CommandEffect>, synchronous?:CommandHandler) { if (this.has(operation)) throw new Error('Operation already registered'); this.asyncHandlers.set(operation, handler); if(synchronous)this.handlers.set(operation,synchronous); }
 isAsync(operation: Operation) { return this.asyncHandlers.has(operation); }
 async runAsync(command: Command, snapshot?: Project): Promise<CommandEffect> { const handler = this.asyncHandlers.get(command.operation); if (!handler) return this.run(command, snapshot); const effect = await handler(command, snapshot); operationResultSchemas[command.operation].parse(effect.result); return effect; }
 private handlers = new Map<Operation, CommandHandler>();
 register(operation: Operation, handler: CommandHandler) { if (this.has(operation)) throw new Error('Operation already registered'); this.handlers.set(operation, handler); }
 parse(input: unknown): Command { return commandSchema.parse(input); }
 run(command: Command, snapshot?: Project): CommandEffect { const handler = this.handlers.get(command.operation); if (!handler) throw new Error('Operation is not available in this core'); const effect = handler(command, snapshot); operationResultSchemas[command.operation].parse(effect.result); return effect; }
 has(operation: Operation) { return this.handlers.has(operation) || this.asyncHandlers.has(operation); }
}
