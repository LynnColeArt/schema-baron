import { createRequire } from 'node:module';
import type { NextServerOptions, RequestHandler } from 'next/dist/server/next.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OwnerService } from './service.js';
import { setOwner, clearOwner } from './runtime.js';
const next = createRequire(import.meta.url)('next') as (options: NextServerOptions) => { prepare(): Promise<void>; close(): Promise<void>; getRequestHandler(): RequestHandler };
/** Explicit configuration is private process input, never NEXT_PUBLIC or a URL token. */
async function main() {
 const configPath = process.env.SCHEMA_BARON_OWNER_CONFIG;
 if (!configPath) throw new Error('SCHEMA_BARON_OWNER_CONFIG must name a private owner JSON configuration file.');
 const config = JSON.parse(readFileSync(configPath, 'utf8'));
 const port = Number(process.env.PORT ?? 4317); if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid owner port.');
 const service = new OwnerService(config);
 let handle: RequestHandler | undefined;
 const server = createServer((request, response) => { if (handle) void handle(request, response); else { response.writeHead(503); response.end(); } });
 server.requestTimeout = 15000; server.headersTimeout = 10000;
 let app: ReturnType<typeof next> | undefined;
 try {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing owner address.');
  const origin = `http://127.0.0.1:${address.port}`; service.setOrigin(origin);
  // Next receives the actual listening port; the route bridge restores the trusted hostname.
  app = next({ dev: false, dir: fileURLToPath(new URL('../', import.meta.url)), hostname: '127.0.0.1', port: address.port });
  await app.prepare(); setOwner(service); handle = app.getRequestHandler();
  process.stderr.write(`Schema Baron owner ready at ${origin}\n`);
  let closing = false;
  const close = () => { if (closing) return; closing = true; server.close(() => { clearOwner(); void service.close().then(() => app!.close()).then(() => { process.exitCode = 0; }); }); server.closeIdleConnections(); };
  process.once('SIGTERM', close); process.once('SIGINT', close);
 } catch (error) { server.close(); service.close(); await app?.close(); throw error; }
}
main().catch(() => { process.stderr.write('Studio owner failed to start; check private configuration and build output.\n'); process.exitCode = 1; });
