import { commandSchema, operationResultSchemas } from '@schema-baron/model';
import type { Command, Operation, Project } from '@schema-baron/model';
export interface CommandEffect { result: unknown; candidate?: Project; root?: string; changedIds?: string[] }
export type CommandHandler = (command: Command, snapshot: Project | undefined) => CommandEffect;
/** Input and result validators come exclusively from the canonical model package. */
export class CommandRegistry {
 private handlers = new Map<Operation, CommandHandler>();
 register(operation: Operation, handler: CommandHandler) { if (this.handlers.has(operation)) throw new Error('Operation already registered'); this.handlers.set(operation, handler); }
 parse(input: unknown): Command { return commandSchema.parse(input); }
 run(command: Command, snapshot?: Project): CommandEffect { const handler = this.handlers.get(command.operation); if (!handler) throw new Error('Operation is not available in this core'); const effect = handler(command, snapshot); operationResultSchemas[command.operation].parse(effect.result); return effect; }
 has(operation: Operation) { return this.handlers.has(operation); }
}
