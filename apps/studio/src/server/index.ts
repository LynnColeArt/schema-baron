import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { OwnerService } from './service.js';
import type { OwnerOptions } from './service.js';
export * from './service.js';
/** Shared by the Next route and the isolated HTTP test harness. */
export async function serve(service: OwnerService, origin: string, incoming: IncomingMessage, outgoing: ServerResponse) {
 try {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) { if (Array.isArray(value)) value.forEach(v => headers.append(name, v)); else if (value !== undefined) headers.set(name, value); }
  const init: RequestInit & { duplex?: 'half' } = { method: incoming.method ?? 'GET', headers };
  if (!['GET', 'HEAD'].includes(init.method!)) { init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = 'half'; }
  const response = await service.handle(new Request(new URL(incoming.url ?? '/', origin), init));
  outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
 } catch { outgoing.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' }); outgoing.end(JSON.stringify({ ok: false, revision: 0, error: { code: 'RECOVERY_REQUIRED', message: 'Owner transport failed.', retryable: true }, diagnostics: [] })); }
}
export interface RunningOwner { service: OwnerService; url: string; close(): Promise<void> }
export async function startOwner(options: OwnerOptions, port = 0): Promise<RunningOwner> {
 const service = new OwnerService(options); let url = '';
 const server = createServer((request, response) => { void serve(service, url, request, response); });
 server.requestTimeout = 15000; server.headersTimeout = 10000;
 try { await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
 catch (error) { await service.close(); throw error; }
 const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing owner address.');
 url = `http://127.0.0.1:${address.port}`; service.setOrigin(url);
 let closing: Promise<void> | undefined;
 return { service, url, close: () => closing ??= (async () => {
  const stopped = new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  server.closeIdleConnections();
  const results = await Promise.allSettled([stopped,service.close()]);
  for(const result of results)if(result.status === 'rejected')throw result.reason;
 })() };
}
