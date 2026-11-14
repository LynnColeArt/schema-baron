import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { startOwner } from '../../../apps/studio/src/server/index.js';
import type { Command } from '@schema-baron/model';

test.use({ trace: 'off' });
test.describe.configure({ retries: 0 });
for (const application of ['workshop', 'library']) test(`${application}: bounded real MCP/direct canonical command parity (separate from UI and full MCP workflow)`, async ({}, info) => {
 const root = mkdtempSync(join(tmpdir(), 'baron-acceptance-parity-'));
 const capability = randomBytes(32).toString('base64url');
 const owner = await startOwner({ ownerId: 'parity-owner', capability, metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'definitions') } });
 const clients: Client[] = [];
 const connect = async (credential: string, suffix: string) => {
  const config = join(root, suffix + '.json'); writeFileSync(config, JSON.stringify({ ownerUrl: owner.url, capability: credential }), { mode: 0o600 });
  const client = new Client({ name: 'bounded-parity', version: '1' }); clients.push(client);
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('apps/mcp/dist/main.js')], cwd: root, env: { SCHEMA_BARON_MCP_CONFIG: config }, stderr: 'pipe' })); return client;
 };
 try {
  const client = await connect(capability, 'connection');
  const command = (operation: string, input: unknown, expectedRevision: number, requestId: string): Command => ({ projectId: application, operation, input, expectedRevision, requestId }) as Command;
  const page = (id: string, route = '/' + id) => ({ kind: 'put', entity: 'page', id, value: { id, route, title: id, formIds: [], document: [] } });
  const call = async (c: Command) => { const { operation, ...args } = c; return (await client.callTool({ name: operation.replaceAll('.', '_'), arguments: args })).structuredContent; };
  const corpus = [
   { c: command('project.create', { name: application + ' parity fixture', target: 'next-typescript-sqlite', approvedRoot: 'projects' }, 0, 'create'), ok: true },
   { c: command('project.batch', { operations: [page('one')] }, 1, 'write'), ok: true },
   { c: command('project.batch', { operations: [page('one')] }, 1, 'write'), ok: true },
   { c: command('project.batch', { operations: [page('stale')] }, 1, 'stale'), code: 'REVISION_CONFLICT' },
   { c: command('project.batch', { operations: [page('reuse')] }, 2, 'write'), code: 'IDEMPOTENCY_CONFLICT' },
   { c: command('project.batch', { operations: [page('duplicate', '/one'), page('must-not-exist')] }, 2, 'invalid'), code: 'VALIDATION_FAILED' },
   { c: command('project.export', { destination: 'projects:../escape.json' }, 2, 'path'), code: 'PATH_OUTSIDE_ROOT' },
  ];
  const observations: unknown[] = [];
  for (const [index, { c, ok, code }] of corpus.entries()) {
   const before = index ? readFileSync(join(root, 'definitions', application + '.json'), 'utf8') : undefined;
   const first = index % 2 ? await call(c) : await owner.service.core.executeAsync('parity-owner', c);
   const second = index % 2 ? await owner.service.core.executeAsync('parity-owner', c) : await call(c);
   expect(second).toEqual(first); expect(first).toMatchObject(ok ? { ok: true } : { ok: false, error: { code } });
   if (!ok) expect(readFileSync(join(root, 'definitions', application + '.json'), 'utf8')).toBe(before);
   observations.push({ operation: c.operation, requestId: c.requestId, expected: code ?? 'success', actual: code ?? 'success', identical: true });
  }
  const snapshot = owner.service.core.snapshot('parity-owner', application); expect(snapshot.revision).toBe(2); expect(snapshot.pages.map(p => p.id)).toEqual(['one']);
  const resource = await client.readResource({ uri: `schema-baron://projects/${application}/snapshot` }); const content = resource.contents[0]!; expect('text' in content && JSON.parse(content.text)).toMatchObject({ result: snapshot });
  const denied = await connect('invalid-isolated-credential-xxxxxxxxxxxxxxxx', 'denied');
  const c = command('project.inspect', {}, 2, 'unauthorized');
  const mcpDenied = await denied.callTool({ name: 'project_inspect', arguments: { projectId: c.projectId, input: c.input, expectedRevision: c.expectedRevision, requestId: c.requestId } });
  expect(mcpDenied).toMatchObject({ isError: true, structuredContent: { ok: false, error: { code: 'AUTH_REQUIRED' } } });
  const response = await fetch(owner.url + `/api/v1/projects/${application}/commands`, { method: 'POST', headers: { authorization: 'Bearer invalid-isolated-credential-xxxxxxxxxxxxxxxx', 'content-type': 'application/json' }, body: JSON.stringify(c) }); expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ ok: false, error: { code: 'AUTH_REQUIRED' } });
  expect(await owner.service.core.executeAsync('intruder', c)).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } });
  expect(owner.service.core.snapshot('parity-owner', application)).toEqual(snapshot);
  writeFileSync(info.outputPath('parity-summary.json'), JSON.stringify({ mode: 'parity', application, scope: 'Bounded smoke only; full MCP workflow and cold UI proof are separate', observations, snapshotRevision: snapshot.revision, pageIds: snapshot.pages.map(p => p.id), authorization: { mcp: 'AUTH_REQUIRED', http: 'AUTH_REQUIRED', wrongOwner: 'ACCESS_DENIED', unchanged: true } }, null, 2));
 } finally { for (const client of clients.reverse()) await client.close(); await owner.close(); rmSync(root, { recursive: true, force: true }); }
});
