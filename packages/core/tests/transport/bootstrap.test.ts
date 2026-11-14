import { expect, test } from 'vitest';
import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
test('built Next owner bootstrap serves actual authenticated API and built stdio client against the same writer', async () => {
 const root = mkdtempSync(join(tmpdir(), 'baron-bootstrap-'));
 const capability = 'private-bootstrap-' + 'z'.repeat(40);
 const config = join(root, 'owner.json'); writeFileSync(config, JSON.stringify({ ownerId: 'owner', capability, metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'definitions') } }), { mode: 0o600 });
 const child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], { env: { ...process.env, PORT: '0', SCHEMA_BARON_OWNER_CONFIG: config }, stdio: ['ignore', 'pipe', 'pipe'] });
 let logs = ''; const exited = once(child, 'exit'); let client: Client | undefined;
 try {
  const url = await new Promise<string>((resolve, reject) => {
   const timeout = setTimeout(() => reject(new Error('Owner bootstrap timeout: ' + logs)), 15000);
   const data = (chunk: Buffer) => { logs += chunk.toString(); const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timeout); resolve(match[1]!); } };
   child.stderr.on('data', data); child.stdout.on('data', data); child.once('exit', () => { clearTimeout(timeout); reject(new Error('Owner exited: ' + logs)); });
  });
  const headers = { authorization: 'Bearer ' + capability, 'content-type': 'application/json' };
  const create = await fetch(url + '/api/v1/projects', { method: 'POST', headers, body: JSON.stringify({ requestId: 'bootstrap', name: 'Bootstrap proof', approvedRoot: 'projects', target: 'next-typescript-sqlite' }) });
  const created = await create.json(); if (!created.ok) throw new Error(JSON.stringify(created) + logs);
  expect(created).toMatchObject({ ok: true, revision: 1, result: { id: 'bootstrap' } });
  expect((await fetch(url + '/api/v1/projects/bootstrap', { headers: { ...headers, origin: 'https://foreign.test' } })).status).toBe(403);
  const forgedHost = await new Promise<number>(resolve => { const req = httpRequest(url + '/api/v1/projects/bootstrap', { headers: { host: 'foreign.test', authorization: 'Bearer ' + capability } }, response => { response.resume(); resolve(response.statusCode!); }); req.end(); }); expect(forgedHost).toBe(403);
  const exchange = await fetch(url + '/api/v1/session', { method: 'POST', headers: { ...headers, origin: url }, body: '{}' });
  expect(exchange.status).toBe(200); const cookie = exchange.headers.get('set-cookie')!.split(';')[0]!; const { result: { csrfToken } } = await exchange.json();
  expect(await (await fetch(url + '/api/v1/session', { headers: { cookie, 'sec-fetch-site': 'same-origin' } })).json()).toMatchObject({ result: { csrfToken } });
  const edited = await fetch(url + '/api/v1/projects/bootstrap/commands', { method: 'POST', headers: { cookie, origin: url, 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ requestId: 'browser-edit', operation: 'project.batch', expectedRevision: 1, input: { operations: [{ kind: 'put', entity: 'page', id: 'page', value: { id: 'page', title: 'Browser page', route: '/page', formIds: [], document: [] } }] } }) });
  expect(await edited.json()).toMatchObject({ ok: true, revision: 2 });
  const connection = join(root, 'mcp.json'); writeFileSync(connection, JSON.stringify({ ownerUrl: url, capability }), { mode: 0o600 });
  client = new Client({ name: 'bootstrap-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('apps/mcp/dist/main.js')], env: { SCHEMA_BARON_MCP_CONFIG: connection }, stderr: 'pipe' }));
  const inspected = await client.callTool({ name: 'project_inspect', arguments: { requestId: 'inspect', projectId: 'bootstrap', expectedRevision: 2, input: {} } });
  expect(inspected).toMatchObject({ structuredContent: { ok: true, revision: 2, result: { name: 'Bootstrap proof', pages: [{ id: 'page' }] } } });
  expect((await fetch(url + '/api/v1/projects/bootstrap')).status).toBe(401);
  expect(JSON.parse(readFileSync(join(root, 'definitions/bootstrap.json'), 'utf8')).revision).toBe(2);
  expect(logs).not.toContain(capability);
 } finally {
  await client?.close(); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await exited; clearTimeout(timer); rmSync(root, { force: true, recursive: true });
 }
});
