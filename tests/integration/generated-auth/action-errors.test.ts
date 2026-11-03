import { expect, test, vi } from 'vitest';
import { stripTypeScriptTypes } from 'node:module';
import { writeFileSync } from 'node:fs';
import { recordFiles } from '../../../packages/generator/src/templates/record/index.js';
import type { RecordIR } from '../../../packages/generator/src/ir/index.js';

// Execute the emitted action's catch boundary. Real HTTP authorization and protocol
// are independently exercised by acceptance/access.spec.ts on UI-authored apps.
class AccessError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function action(failure: unknown, guardSuppressed = false) {
 const record = { label: 'Records', controls: [], source: { fields: [], keys: [] }, config: { id: 'record', pageId: 'page', source: { fields: [], keys: [] }, controls: [], actions: [], keyParameters: [], context: [] } } as unknown as RecordIR;
 const source = recordFiles(record, 0, 'flash').find(file => file.path === 'server/record-action-0.ts')!.content;
 const execute = vi.fn(() => ({ values: {}, errors: {}, summary: '' })), exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
 const emitted = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''), { mode: 'strip' }).replace('export async function submit0', 'exports.submit0 = async function');
 new Function('AccessError', 'guardAction', 'config', 'execute', 'context', 'exports', emitted)(AccessError, async () => { if (!guardSuppressed) throw failure; }, record.config, execute, (parameters: unknown) => parameters, exports);
 const data = new FormData(); data.set('_action', 'write'); data.set('_parameters', '{}');
 return { submit: () => exports.submit0!({}, data), execute };
}
test.each([[401, 'Sign in is required.', 'Sign in is required.'], [403, 'CSRF validation failed.', 'Reload this page and sign in again before trying this action.']] as const)('emitted server action preserves safe %i access diagnostic', async (status, message, expected) => {
 const { submit, execute } = action(new AccessError(status, message));
 expect(await submit()).toEqual({ values: {}, errors: {}, summary: expected }); expect(execute).not.toHaveBeenCalled();
});
test('unclassified errors retain the generic diagnostic and do not expose details', async () => {
 const { submit } = action(new Error('private detail')); expect(await submit()).toEqual({ values: {}, errors: {}, summary: 'The submitted record parameters are invalid.' });
});
test('framework redirects survive the action catch boundary', async () => {
 const redirect = Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT' }); const { submit } = action(redirect);
 await expect(submit()).rejects.toBe(redirect);
});

test('fault-mode guard suppression is detected by the same unauthorized no-write invariant', async () => {
 const denied = action(new AccessError(401, 'Sign in is required.'));
 const noWrite = (execute: ReturnType<typeof vi.fn>) => expect(execute).not.toHaveBeenCalled();
 await denied.submit(); noWrite(denied.execute);
 const weakened = action(undefined, true); await weakened.submit();
 expect(weakened.execute).toHaveBeenCalledTimes(1);
 expect(() => noWrite(weakened.execute)).toThrow();
 if (process.env.SCHEMA_BARON_ACCESS_FAULT_EVIDENCE) writeFileSync(process.env.SCHEMA_BARON_ACCESS_FAULT_EVIDENCE, JSON.stringify({ mode: 'isolated lower-seam authorization negative control', realEmittedAction: true, guard: 'injected no-op in test execution only', protectedControlWriteCount: denied.execute.mock.calls.length, weakenedGuardWriteCount: weakened.execute.mock.calls.length, sameUnauthorizedNoWriteInvariant: 'red detected', liveApplicationSourcePatched: false }, null, 2));
});
