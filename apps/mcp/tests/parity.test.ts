import { afterEach, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startOwner } from '../../studio/src/server/index.js';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });
const cap = 'test-mcp-capability-' + 'x'.repeat(40);
async function setup(forged = false) {
 const root = mkdtempSync(join(tmpdir(), 'baron-mcp-'));
 const owner = await startOwner({ ownerId: 'owner', capability: cap, metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'definitions') } });
 cleanups.push(async () => { await owner.close(); rmSync(root, { force: true, recursive: true }); });
 const cwd = join(root, 'mcp.json'); writeFileSync(cwd, JSON.stringify({ ownerUrl: owner.url, capability: forged ? 'forged'.repeat(10) : cap }), { mode: 0o600 });
 const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('apps/mcp/dist/main.js')], cwd: root, env: { SCHEMA_BARON_MCP_CONFIG: cwd }, stderr: 'pipe' });
 let stderr = ''; transport.stderr?.on('data', value => { stderr += value.toString(); });
 const client = new Client({ name: 'parity-proof', version: '1' }); await client.connect(transport);
 cleanups.push(() => client.close());
 const http = async (body: Record<string, unknown>) => { const response = await fetch(owner.url + '/api/v1/projects/p/commands', { method: 'POST', headers: { authorization: 'Bearer ' + cap, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, outcome: await response.json() }; };
 const mcp = async (body: Record<string, unknown>) => { const { operation, ...args } = body; const result = await client.callTool({ name: String(operation).replaceAll('.', '_'), arguments: args }); return result.structuredContent; };
 return { owner, client, transport, root, http, mcp, stderr: () => stderr };
}
const command = (operation: string, input: unknown, expectedRevision = 1, requestId: string = crypto.randomUUID()) => ({ operation, input, projectId: 'p', expectedRevision, requestId });
const page = (id: string, route = '/' + id) => ({ kind: 'put', entity: 'page', id, value: { id, route, title: id, formIds: [], document: [] } });
test('real SDK stdio client creates and changes the HTTP owner; valid/invalid/stale corpus has identical outcomes and no partial writes', async () => {
 const { client, root, http, mcp, stderr } = await setup();
 const tools = await client.listTools(); expect(tools.tools.map(t => t.name)).toContain('project_batch'); expect(tools.tools.map(t => t.name)).not.toContain('schema_apply');
 expect(tools.tools.find(t => t.name === 'project_batch')?.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
 const create = command('project.create', { name: 'Independent blank', target: 'next-typescript-sqlite', approvedRoot: 'projects' }, 0, 'create');
 const created = await mcp(create); expect(created).toMatchObject({ ok: true, revision: 1, result: { pages: [], schema: { tables: [] } } }); expect((await http(create)).outcome).toEqual(created);
 const cases = [
  { command: command('project.batch', { operations: [page('first')] }, 1, 'first'), status: 200 },
  { command: command('project.batch', { operations: [page('second')] }, 2, 'second'), status: 200 },
  { command: command('project.batch', { operations: [page('stale')] }, 1, 'stale'), status: 409 },
  { command: command('project.batch', { operations: [page('bad')], sql: 'DROP TABLE secret' }, 3, 'invalid'), status: 400 },
  { command: command('project.batch', { operations: [page('duplicate', '/first'), page('unrelated')] }, 3, 'semantic'), status: 422 },
  { command: command('project.batch', { operations: [page('reuse')] }, 3, 'first'), status: 409 },
  { command: command('project.export', { destination: 'projects:../escape.json' }, 3, 'traversal'), status: 403 },
  { command: command('project.inspect', {}, 3, 'inspect'), status: 200 },
 ];
 for (const [index, item] of cases.entries()) {
  const before = readFileSync(join(root, 'definitions/p.json'), 'utf8');
  const agent = index % 2 ? await mcp(item.command) : undefined;
  const browser = await http(item.command); expect(browser.status).toBe(item.status);
  expect(agent ?? await mcp(item.command)).toEqual(browser.outcome);
  if (item.status !== 200) expect(readFileSync(join(root, 'definitions/p.json'), 'utf8')).toBe(before);
 }
 const snapshot = await client.readResource({ uri: 'schema-baron://projects/p/snapshot' });
 const text = snapshot.contents[0]!; expect('text' in text && JSON.parse(text.text)).toMatchObject({ revision: 3, result: { pages: [{ id: 'first' }, { id: 'second' }] } });
 const resources = await client.listResources(); expect(resources.resources.map(r => r.uri)).toContain('schema-baron://projects/p/diagnostics');
 expect((await client.listResourceTemplates()).resourceTemplates).toHaveLength(3);
 const missing = await client.callTool({ name: 'schema_apply', arguments: {} }); expect(missing).toMatchObject({ isError: true, structuredContent: { error: { code: 'INVALID_INPUT' } } });
 const noRequestId = await client.callTool({ name: 'project_batch', arguments: { projectId: 'p', expectedRevision: 3, input: { operations: [page('missing')] } } }); expect(noRequestId).toMatchObject({ isError: true, structuredContent: { error: { code: 'INVALID_INPUT' } } });
 expect(readdirSync(root).sort()).toEqual(['definitions', 'mcp.json', 'metadata']);
 expect(stderr()).not.toContain(cap);
});
test('MCP job tools/resources see committed and running owner jobs with stale/duplicate cancel protection', async () => {
 const { owner, client, http, mcp } = await setup();
 await mcp(command('project.create', { name: 'Jobs', target: 'next-typescript-sqlite', approvedRoot: 'projects' }, 0));
 owner.service.core.recordJob('owner', 'p', { id: 'running', status: 'running', committed: false, diagnostics: [] });
 expect(await mcp(command('job.cancel', { jobId: 'running' }, 1, 'no-controller'))).toMatchObject({ result: { status: 'running' } });
 const finalOutcome = { ok: true as const, revision: 1, result: { retained: 'actual worker result' }, diagnostics: [] };
 owner.service.registerJobCanceler('p', 'running', job => ({ ...job, status: 'succeeded', committed: true, outcome: finalOutcome }));
 const cancel = command('job.cancel', { jobId: 'running' }, 1, 'raced'); const outcome = await mcp(cancel); expect(outcome).toMatchObject({ result: { status: 'succeeded', committed: true } }); expect((await http(cancel)).outcome).toEqual(outcome);
 expect(await mcp(command('job.cancel', { jobId: 'running' }, 1, 'late'))).toMatchObject({ result: { status: 'succeeded', committed: true } });
 const resource = await client.readResource({ uri: 'schema-baron://projects/p/jobs/running' }); expect(resource.contents[0]).toMatchObject({ mimeType: 'application/json' });
 const content = resource.contents[0]!; expect('text' in content && JSON.parse(content.text)).toMatchObject({ result: { outcome: finalOutcome } });
 expect((await http(command('job.inspect', { jobId: 'running' }))).outcome).toMatchObject({ result: { outcome: finalOutcome } });
 const missing = await mcp(command('job.inspect', { jobId: 'missing' }, 1)); expect(missing).toMatchObject({ error: { code: 'NOT_FOUND' } });
});
test('forged MCP owner credentials cannot discover or read owner state', async () => {
 const { client, root, stderr } = await setup(true);
 await expect(client.listTools()).rejects.toThrow('Owner capability discovery failed');
 expect(await client.callTool({ name: 'project_inspect', arguments: { projectId: 'p', requestId: 'forged', expectedRevision: 1, input: {} } })).toMatchObject({ isError: true, structuredContent: { error: { code: 'AUTH_REQUIRED' } } });
 const result = await client.readResource({ uri: 'schema-baron://projects/p/snapshot' });
 expect(result.contents[0]).toMatchObject({ text: expect.stringContaining('AUTH_REQUIRED') });
 expect(readdirSync(join(root, 'definitions')).some(p => p.endsWith('.json'))).toBe(false);
 expect(stderr()).not.toContain('forged'.repeat(10));
});
