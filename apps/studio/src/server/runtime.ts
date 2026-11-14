import type { OwnerService } from './service.js';
const runtime = globalThis as typeof globalThis & { schemaBaronOwner?: OwnerService };
export function setOwner(service: OwnerService) { if (runtime.schemaBaronOwner) throw new Error('Owner is already configured.'); runtime.schemaBaronOwner = service; }
export function getOwner(): OwnerService { if (!runtime.schemaBaronOwner) throw new Error('Start Studio through its owner bootstrap.'); return runtime.schemaBaronOwner; }
export function clearOwner() { delete runtime.schemaBaronOwner; }
