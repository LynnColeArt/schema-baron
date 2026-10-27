import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalWorkspace, defaultOwnerConfig } from './workspace.js';
import { startOwner, type RunningOwner } from './index.js';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });
const capability = 'test-only-private-capability-'.repeat(2);
function fixture() {
 const root = mkdtempSync(join(tmpdir(), 'schema-baron-workspace-'));
 cleanups.push(() => rmSync(root, { recursive: true, force: true }));
 const file = join(root, 'private', 'workspace.json');
 return { root, file, workspace: new LocalWorkspace(file, join(root, 'home')) };
}
async function ownerFor(workspace: LocalWorkspace, root: string, localBrowser = true) {
 const owner = await startOwner({ ownerId: 'local', capability, metadataRoot: join(root, 'metadata'), approvedRoots: { ...workspace.roots }, localBrowser, workspace });
 cleanups.push(() => owner.close()); return owner;
}
async function session(owner: RunningOwner) {
 const response = await fetch(`${owner.url}/api/v1/session`, { method: 'POST', headers: { origin: owner.url, 'sec-fetch-site': 'same-origin', 'x-schema-baron-local': '1', 'content-type': 'application/json' }, body: '{}' });
 expect(response.status).toBe(200);
 const body = await response.json();
 return { cookie: response.headers.get('set-cookie')!.split(';')[0]!, origin: owner.url, 'x-csrf-token': body.result.csrfToken, 'content-type': 'application/json' };
}
test('first run defaults to ~/projects/schema-baron and persists a chosen folder privately', () => {
 const { root, file, workspace } = fixture();
 expect(workspace.settings()).toEqual({ configured: false, projectsFolder: join(root, 'home/projects/schema-baron') });
 expect(workspace.save('~/projects/schema-baron').configured).toBe(true);
 expect(new LocalWorkspace(file).settings()).toEqual(workspace.settings());
 expect(statSync(file).mode & 0o777).toBe(0o600);
 expect(() => workspace.save('relative/path')).toThrow('absolute');
 const ordinaryFile = join(root, 'not-a-folder'); writeFileSync(ordinaryFile, 'keep');
 expect(() => workspace.save(ordinaryFile)).toThrow('writable');
 expect(readFileSync(ordinaryFile, 'utf8')).toBe('keep');
 const alias = join(root, 'alias'); symlinkSync(join(root, 'home'), alias);
 expect(() => workspace.save(alias)).toThrow('Symbolic links');
 expect(workspace.settings().projectsFolder).toBe(join(root, 'home/projects/schema-baron'));
});
test('startup creates a private MCP credential once without requiring manual configuration', () => {
 const { root } = fixture(), file = join(root, 'state/owner.json');
 const first = defaultOwnerConfig(file), second = defaultOwnerConfig(file);
 expect(first.capability.length).toBeGreaterThanOrEqual(32);
 expect(second).toEqual(first); expect(statSync(file).mode & 0o777).toBe(0o600);
});
test('keyless browser exchange keeps exact origin, fetch metadata, CSRF, and direct API authentication', async () => {
 const { root, workspace } = fixture(); const owner = await ownerFor(workspace, root);
 for (const override of [{ origin: 'http://evil.test' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': '' }, { 'x-schema-baron-local': '' }, { authorization: 'Bearer invalid' }]) {
  const response = await fetch(`${owner.url}/api/v1/session`, { method: 'POST', headers: { origin: owner.url, 'sec-fetch-site': 'same-origin', 'x-schema-baron-local': '1', 'content-type': 'application/json', ...override }, body: '{}' });
  expect(response.status).toBeGreaterThanOrEqual(400);
 }
 expect((await fetch(`${owner.url}/api/v1/capabilities`)).status).toBe(401);
 const headers = await session(owner);
 expect((await fetch(`${owner.url}/api/v1/capabilities`, { headers })).status).toBe(200);
 const { 'x-csrf-token': _csrf, ...noCsrf } = headers;
 expect((await fetch(`${owner.url}/api/v1/workspace`, { method: 'PUT', headers: noCsrf, body: JSON.stringify({ projectsFolder: join(root, 'projects') }) })).status).toBe(403);
 expect((await fetch(`${owner.url}/api/v1/capabilities`, { headers: { authorization: `Bearer ${capability}` } })).status).toBe(200);
});
test('isolated API harness still requires its explicit capability', async () => {
 const { root, workspace } = fixture(); const owner = await ownerFor(workspace, root, false);
 const response = await fetch(`${owner.url}/api/v1/session`, { method: 'POST', headers: { origin: owner.url, 'sec-fetch-site': 'same-origin', 'x-schema-baron-local': '1', 'content-type': 'application/json' }, body: '{}' });
 expect(response.status).toBe(401);
});
test('new projects have separate folders/output; changing the base and restarting preserves old projects and retries', async () => {
 const { root, file, workspace } = fixture(); let owner = await ownerFor(workspace, root);
 let headers = await session(owner);
 const call = async (path: string, body?: unknown, method = body ? 'POST' : 'GET') => {
  const response = await fetch(`${owner.url}/api/v1/${path}`, { headers, method, ...(body ? { body: JSON.stringify(body) } : {}) });
  return response.json();
 };
 const create = (name: string, requestId: string) => call('projects', { name, requestId, approvedRoot: '', target: 'next-typescript-sqlite' });
 expect((await create('First', 'first')).error.code).toBe('INVALID_INPUT');
 expect((await call('workspace', { projectsFolder: join(root, 'base-one') }, 'PUT')).ok).toBe(true);
 const first = await create('First', 'first'); expect(first.ok).toBe(true);
 expect(readdirSync(join(root, 'base-one/First'))).toContain('first.json');
 expect(first.result.outputConfig.relativePath).toBe('generated/app');
 expect((await create('First', 'first')).result).toEqual(first.result);
 expect((await create('First', 'other')).error.code).toBe('INVALID_INPUT');
 expect((await create('../escape', 'escape')).ok).toBe(false);
 expect((await create('second', 'first')).error.code).toBe('IDEMPOTENCY_CONFLICT');
 expect((await call('workspace', { projectsFolder: join(root, 'base-two') }, 'PUT')).ok).toBe(true);
 const second = await create('Second', 'second'); expect(second.ok).toBe(true);
 expect(second.result.outputConfig.approvedRootId).not.toBe(first.result.outputConfig.approvedRootId);
 expect(readdirSync(join(root, 'base-two/Second'))).toContain('second.json');
 const saved = readFileSync(join(root, 'base-one/First/first.json'), 'utf8');
 await owner.close();
 const restored = new LocalWorkspace(file); owner = await ownerFor(restored, root); headers = await session(owner);
 expect((await call('projects/first')).result.name).toBe('First');
 expect((await call('projects/second')).result.name).toBe('Second');
 expect((await create('First', 'first')).result.id).toBe('first');
 expect(readFileSync(join(root, 'base-one/First/first.json'), 'utf8')).toBe(saved);
 expect(restored.settings().projectsFolder).toBe(join(root, 'base-two'));
 expect(() => owner.service.core.addApprovedRoot(first.result.outputConfig.approvedRootId, join(root, 'elsewhere'))).toThrow('relocated');
});
