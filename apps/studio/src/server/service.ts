import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { ProjectCore } from '@schema-baron/core';
import type { CommandEffect, CoreOptions, Outcome } from '@schema-baron/core';
import { StorageError } from '@schema-baron/storage';
import { commandSchema, createId, idSchema, jobSchema, operationInputSchemas, operationResultSchemas } from '@schema-baron/model';
import type { Command, Job, Operation, OperationResult, Project } from '@schema-baron/model';
import { z } from 'zod';
import type { LocalWorkspace } from './workspace.js';
export interface OwnerOptions extends CoreOptions { localBrowser?: boolean; workspace?: LocalWorkspace; capability: string; maxPayloadBytes?: number; sessionTtlMs?: number }
export type FeatureEffect<K extends Operation> = Omit<CommandEffect, 'result'> & { result: OperationResult<K> };
export const failure = (code: string, message: string, revision = 0): Outcome => ({ ok: false, revision, error: { code, message, retryable: code === 'RECOVERY_REQUIRED' || code === 'PROJECT_BUSY' }, diagnostics: [] });
export function status(outcome: Outcome): number {
 if (outcome.ok) return 'jobId' in outcome ? 202 : 200;
 const code = outcome.error.code;
 if (code === 'AUTH_REQUIRED') return 401;
 if (['ACCESS_DENIED', 'PATH_OUTSIDE_ROOT'].includes(code)) return 403;
 if (code === 'NOT_FOUND') return 404;
 if (['REVISION_CONFLICT', 'DATABASE_CHANGED', 'PLAN_EXPIRED', 'PLAN_HASH_MISMATCH', 'OUTPUT_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(code)) return 409;
 if (code === 'PROJECT_BUSY') return 423;
 if (code === 'INVALID_INPUT') return 400;
 if (code === 'RECOVERY_REQUIRED') return 500;
 return 422;
}
const equal = (a: string, b: string) => { const hash = (s: string) => createHash('sha256').update(s).digest(); return timingSafeEqual(hash(a), hash(b)); };
const token = () => randomBytes(32).toString('base64url');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const queryInteger = (value: string | null, fallback: number, min = 0) => { if (value === null) return fallback; if (!/^\d+$/.test(value)) throw new StorageError('INVALID_INPUT', 'Invalid integer query parameter.'); const n = Number(value); if (!Number.isSafeInteger(n) || n < min) throw new StorageError('INVALID_INPUT', 'Invalid integer query parameter.'); return n; };
export class OwnerService {
 readonly core: ProjectCore;
 private sessions = new Map<string, { csrf: string; expires: number }>();
 private secrets = new Set<string>();
 private origin?: string;
 private cancelers = new Map<string, (job: Job) => Job>();
 /** A running worker must acknowledge its actual state; absence of a controller leaves it running. */
 registerJobCanceler(projectId: string, jobId: string, cancel: (job: Job) => Job) { const id = JSON.stringify([projectId, jobId]); if (this.cancelers.has(id)) throw new Error('Job canceler already registered.'); this.cancelers.set(id, cancel); }
 constructor(private options: OwnerOptions) {
  if (options.capability.length < 32) throw new Error('Owner capability must have at least 32 characters.');
  this.secrets.add(options.capability);
  this.core = new ProjectCore({...options,runtimeSecrets:[...(options.runtimeSecrets??[]),options.capability]});
  this.register('job.inspect', (command, project) => { const job = this.core.job(options.ownerId, command.projectId, command.input.jobId); if (!job) throw new StorageError('NOT_FOUND', 'Unknown job.'); return { result: jobSchema.parse(job) }; });
  this.core.registry.registerAsync('job.cancel', async (input) => {
   if (input.operation !== 'job.cancel') throw new StorageError('INVALID_INPUT', 'Expected job cancellation.');
   const command = input;
   const runtime = await this.core.cancelRuntime(options.ownerId,command.projectId,command.input.jobId);
   if(runtime)return {result:runtime,job:runtime};
   const migration = await this.core.cancelMigration(command.projectId, command.input.jobId);
   if (migration) return { result: migration };
   const value = this.core.job(options.ownerId, command.projectId, command.input.jobId); if (!value) throw new StorageError('NOT_FOUND', 'Unknown job.');
   const job = jobSchema.parse(value);
   // Generic controllers run before the first await, preserving their synchronous effect boundary.
   if (job.committed || !['pending', 'running'].includes(job.status)) return { result: job };
   const cancellation = this.core.cancelQueryPreview(options.ownerId, command.projectId, job.id);
   if (cancellation) { const preview = await cancellation; return { result: preview, job: preview }; }
   const controller = this.cancelers.get(JSON.stringify([command.projectId, job.id]));
   const observed = controller ? jobSchema.parse(controller(structuredClone(job))) : job.status === 'pending' ? { ...job, status: 'canceled' as const } : job;
   if (observed.id !== job.id) throw new StorageError('VALIDATION_FAILED', 'Cancellation must preserve job identity.');
   return { result: observed, job: observed };
  });
 }
 setOrigin(origin: string) { const url = new URL(origin); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== origin) throw new Error('Owner must use an exact IPv4 loopback origin.'); if (this.origin) throw new Error('Owner origin already set.'); this.origin = origin; }
 /** Features supply typed effects; core retains schema/result validation, owner, revision,
  * candidate invariants, journal and idempotency. Reviewed applies use core.plans. */
 register<K extends Exclude<Operation, 'schema.apply' | 'generation.apply'>>(operation: K, handler: (command: Extract<Command, { operation: K }>, snapshot: Project | undefined) => FeatureEffect<K>) {
  if (['schema.apply', 'generation.apply'].includes(operation)) throw new Error('Reviewed apply requires registerReviewedApply.');
  this.core.registry.register(operation, (command, snapshot) => handler(command as Extract<Command, { operation: K }>, snapshot));
 }
 /** withLease must hold the feature's external lease while work validates observed fingerprints
  * and runs its handler. Validation happens under that lease immediately before side effects. */
 registerReviewedApply<K extends 'schema.apply' | 'generation.apply'>(operation: K, feature: {
  withLease: (command: Extract<Command, { operation: K }>, work: (observed: { fingerprint: string; dataFingerprint?: string; now: string }) => CommandEffect) => CommandEffect;
  apply: (command: Extract<Command, { operation: K }>, snapshot: Project) => FeatureEffect<K>;
 }) {
  this.core.registry.register(operation, (command, snapshot) => {
   const typed = command as Extract<Command, { operation: K }>;
   if (!snapshot) throw new StorageError('INVALID_INPUT', 'Project is required.');
   const input = operationInputSchemas['generation.apply'].parse(command.input);
   let calls = 0;
   const effect = feature.withLease(typed, observed => {
    if (++calls !== 1) throw new StorageError('VALIDATION_FAILED', 'Apply lease callback must run exactly once.');
    const plan = this.core.plans.inspect(this.options.ownerId, command.projectId, input.planId);
    if (plan.kind !== (operation === 'schema.apply' ? 'migration' : 'generation')) throw new StorageError('PLAN_HASH_MISMATCH', 'Plan kind does not match the apply operation.');
    const diagnostics = this.core.plans.validate(this.options.ownerId, command.projectId, input, observed);
    if (diagnostics.length) throw new StorageError(diagnostics[0]!.code, diagnostics[0]!.message);
    return feature.apply(typed, snapshot);
   });
   if (calls !== 1) throw new StorageError('VALIDATION_FAILED', 'Apply lease callback is required.');
   return effect;
  });
 }
 private redact(value: unknown): string { let json = JSON.stringify(value); for (const secret of this.secrets) json = json.split(secret).join('[REDACTED]'); return json; }
 private response(outcome: Outcome, headers: Record<string, string> = {}, overrideStatus?: number): Response { return new Response(this.redact(outcome), { status: overrideStatus ?? status(outcome), headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } }); }
 private checkBoundary(request: Request) {
  if (!this.origin || new URL(request.url).origin !== this.origin || request.headers.get('host') !== new URL(this.origin).host) throw new StorageError('ACCESS_DENIED', 'Owner origin is required.');
  const origin = request.headers.get('origin');
  if ((origin && origin !== this.origin) || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') ?? '')) throw new StorageError('ACCESS_DENIED', 'Same-origin access is required.');
 }
 private authenticate(request: Request): { session?: string } {
  const authorization = request.headers.get('authorization');
  if (authorization !== null) { if (!equal(authorization, `Bearer ${this.options.capability}`)) throw new StorageError('AUTH_REQUIRED', 'Owner authentication is required.'); return {}; }
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim());
  const matches = cookies.filter(v => v.startsWith('sb_owner='));
  if (matches.length !== 1) throw new StorageError('AUTH_REQUIRED', 'Owner authentication is required.');
  const key = digest(matches[0]!.slice('sb_owner='.length)); const session = this.sessions.get(key);
  if (!session || session.expires <= Date.now()) { this.sessions.delete(key); throw new StorageError('AUTH_REQUIRED', 'Owner session expired.'); }
  if (request.headers.get('origin') !== this.origin && !(request.headers.get('origin') === null && request.headers.get('sec-fetch-site') === 'same-origin')) throw new StorageError('ACCESS_DENIED', 'Browser session requests require the owner origin.');
  if (!['GET', 'HEAD'].includes(request.method) && !equal(request.headers.get('x-csrf-token') ?? '', session.csrf)) throw new StorageError('ACCESS_DENIED', 'Browser write requires CSRF proof.');
  return { session: key };
 }
 private async body(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new StorageError('INVALID_INPUT', 'JSON content type is required.');
  const max = this.options.maxPayloadBytes ?? 1024 * 1024;
  if (Number(request.headers.get('content-length')) > max) throw new StorageError('PAYLOAD_TOO_LARGE', 'Payload exceeds the owner limit.');
  const reader = request.body?.getReader(); if (!reader) throw new StorageError('INVALID_INPUT', 'JSON body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > max) { await reader.cancel(); throw new StorageError('PAYLOAD_TOO_LARGE', 'Payload exceeds the owner limit.'); } chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new StorageError('INVALID_INPUT', 'Malformed JSON body.'); }
 }
 private query(url: URL, allowed: string[]) { for (const name of url.searchParams.keys()) if (!allowed.includes(name) || url.searchParams.getAll(name).length !== 1) throw new StorageError('INVALID_INPUT', 'Unknown or repeated query parameter.'); }
 private snapshot(id: string): Outcome { try { const project = this.core.snapshot(this.options.ownerId, id); return { ok: true, revision: project.revision, result: project, diagnostics: [] }; } catch (error) { if (error instanceof StorageError && error.code === 'INVALID_INPUT') return failure('NOT_FOUND', 'Unknown project.'); throw error; } }
 private async dispatch(input: unknown): Promise<Outcome> {
  const parsed = commandSchema.safeParse(input); if (!parsed.success) return failure('INVALID_INPUT', 'Command does not match the operation schema.');
  return this.core.executeAsync(this.options.ownerId, parsed.data);
 }
 /** Next's Node adapter normalizes Request URL hostname to localhost. Restore the trusted
  * listening origin; original Host and Origin headers are still checked before authentication. */
 handleNext(request: Request): Promise<Response> {
  if (!this.origin) return Promise.resolve(this.response(failure('RECOVERY_REQUIRED', 'Owner service is unavailable.')));
  const url = new URL(request.url);
  return this.handle(new Request(new URL(url.pathname + url.search, this.origin), request));
 }
 async handle(request: Request): Promise<Response> {
  try {
   this.checkBoundary(request);
   const url = new URL(request.url); const method = request.method;
   const localExchange = this.options.localBrowser && url.pathname === '/api/v1/session' && method === 'POST' && request.headers.get('authorization') === null && request.headers.get('origin') === this.origin && request.headers.get('sec-fetch-site') === 'same-origin' && request.headers.get('x-schema-baron-local') === '1';
   const auth: { session?: string } = localExchange ? {} : this.authenticate(request);
   if (!url.pathname.startsWith('/api/v1/')) return this.response(failure('NOT_FOUND', 'Unknown endpoint.'));
   const parts = url.pathname.slice('/api/v1/'.length).split('/').map(decodeURIComponent);
   const [area, id, action] = parts;
   if (area === 'session' && parts.length === 1) {
    this.query(url, []);
    if (method === 'GET' && auth.session) return this.response({ ok: true, revision: 0, result: { csrfToken: this.sessions.get(auth.session)!.csrf }, diagnostics: [] });
    if (method === 'POST') {
     if (auth.session || request.headers.get('origin') !== this.origin) throw new StorageError('ACCESS_DENIED', 'Session exchange requires owner capability and same origin.');
     if (!z.strictObject({}).safeParse(await this.body(request)).success) throw new StorageError('INVALID_INPUT', 'Session exchange expects an empty object.');
     for (const [key, value] of this.sessions) if (value.expires <= Date.now()) this.sessions.delete(key);
     if (this.sessions.size >= 100) throw new StorageError('ACCESS_DENIED', 'Too many owner sessions.');
     const session = token(); const csrfToken = token(); const ttl = this.options.sessionTtlMs ?? 3600000;
     this.secrets.add(session); // Tokens are never logged. CSRF is explicitly returned once.
     this.sessions.set(digest(session), { csrf: csrfToken, expires: Date.now() + ttl });
     return this.response({ ok: true, revision: 0, result: { csrfToken }, diagnostics: [] }, { 'set-cookie': `sb_owner=${session}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=${Math.floor(ttl / 1000)}` });
    }
    if (method === 'DELETE' && auth.session) { this.sessions.delete(auth.session); return this.response({ ok: true, revision: 0, result: { revoked: true }, diagnostics: [] }, { 'set-cookie': 'sb_owner=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0' }); }
   }
   if (area === 'workspace' && parts.length === 1 && this.options.workspace) {
    this.query(url, []);
    if (method === 'GET') return this.response({ ok: true, revision: 0, result: this.options.workspace.settings(), diagnostics: [] });
    if (method === 'PUT') {
     const input = z.strictObject({ projectsFolder: z.string().min(1).max(4096) }).safeParse(await this.body(request));
     if (!input.success) throw new StorageError('INVALID_INPUT', 'Choose a projects folder.');
     return this.response({ ok: true, revision: 0, result: this.options.workspace.save(input.data.projectsFolder), diagnostics: [] });
    }
   }
   if (area === 'capabilities' && parts.length === 1 && method === 'GET') {
    this.query(url, []);
    const operations = (Object.keys(operationInputSchemas) as Operation[]).filter(op => this.core.registry.has(op)).map(operation => ({ operation, inputSchema: z.toJSONSchema(z.strictObject({ requestId: idSchema, projectId: idSchema, expectedRevision: z.number().int().min(operation === 'project.create' || operation === 'project.list' ? 0 : 1).max(Number.MAX_SAFE_INTEGER), input: operationInputSchemas[operation] }), { io: 'input' }), resultSchema: z.toJSONSchema(operationResultSchemas[operation]) }));
    return this.response({ ok: true, revision: 0, result: { version: 1, operations, approvedRootIds: Object.keys(this.options.approvedRoots), ...(this.options.workspace ? { workspace: this.options.workspace.settings() } : {}) }, diagnostics: [] });
   }
   if (area === 'projects') {
    if (parts.length === 1 && method === 'GET') { this.query(url, ['approvedRoot']); return this.response(await this.dispatch({ requestId: createId(), projectId: 'catalog', operation: 'project.list', expectedRevision: 0, input: { approvedRoot: url.searchParams.get('approvedRoot') ?? '' } })); }
    if (parts.length === 1 && method === 'POST') {
     this.query(url, []);
     const body = z.strictObject({ requestId: idSchema, name: z.string().min(1), approvedRoot: z.string(), target: z.literal('next-typescript-sqlite') }).safeParse(await this.body(request));
     if (!body.success || /[/\\]/.test(body.data.requestId) || ['.', '..'].includes(body.data.requestId)) return this.response(failure('INVALID_INPUT', 'Invalid project creation request.'));
     // The OpenAPI convenience form uses requestId as project identity, so retries remain stable.
     const { requestId, ...input } = body.data;
     if (this.options.workspace && input.approvedRoot === '') {
      const root = this.options.workspace.project(input.name, requestId, this.core);
      return this.response(await this.dispatch({ requestId, projectId: requestId, operation: 'project.create', expectedRevision: 0, input: { ...input, approvedRoot: root, outputConfig: { approvedRootId: root, relativePath: 'generated/app' } } }));
     }
     return this.response(await this.dispatch({ requestId, projectId: requestId, operation: 'project.create', expectedRevision: 0, input }));
    }
    if (!idSchema.safeParse(id).success || id?.includes('/') || id?.includes('\\')) return this.response(failure('INVALID_INPUT', 'Invalid project ID.'));
    if (parts.length === 2 && method === 'GET') { this.query(url, []); return this.response(this.snapshot(id!)); }
    if (parts.length === 3 && action === 'commands' && method === 'POST') {
     this.query(url, []); const body = await this.body(request);
     if (!body || typeof body !== 'object' || Array.isArray(body)) return this.response(failure('INVALID_INPUT', 'Command body must be an object.'));
     const value = body as Record<string, unknown>;
     if (value.projectId !== undefined && value.projectId !== id) return this.response(failure('INVALID_INPUT', 'Route and command project must agree.'));
     return this.response(await this.dispatch({ ...value, projectId: id }));
    }
    if (parts.length === 3 && action === 'diagnostics' && method === 'GET') { this.query(url, []); const snapshot = this.snapshot(id!); if (!snapshot.ok) return this.response(snapshot); return this.response(await this.dispatch({ requestId: createId(), projectId: id, operation: 'project.validate', expectedRevision: snapshot.revision, input: {} })); }
    if (parts.length === 3 && action === 'events' && method === 'GET') {
     this.query(url, ['afterSequence', 'limit']); const snapshot = this.snapshot(id!); if (!snapshot.ok) return this.response(snapshot);
     const replay = this.core.events(this.options.ownerId, id!, queryInteger(url.searchParams.get('afterSequence'), 0), queryInteger(url.searchParams.get('limit'), 100, 1));
     const events = replay.events as { sequence: number; kind: string }[];
     // Finite SSE replay: reconnect using last sequence; refetch on gap before applying anything.
     const data = replay.refetchRequired ? `event: refetch\ndata: ${this.redact({ refetchRequired: true, snapshotUrl: `/api/v1/projects/${encodeURIComponent(id!)}` })}\n\n` : events.map(event => `id: ${event.sequence}\nevent: ${event.kind}\ndata: ${this.redact(event)}\n\n`).join('') + `event: replay-complete\ndata: ${this.redact({ refetchRequired: false, lastSequence: events.at(-1)?.sequence ?? queryInteger(url.searchParams.get('afterSequence'), 0) })}\n\n`;
     return new Response(data, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    }
   }
   if (area === 'jobs' && parts.length === 2 && idSchema.safeParse(id).success && ['GET', 'DELETE'].includes(method)) {
    this.query(url, method === 'DELETE' ? ['projectId', 'requestId', 'expectedRevision'] : ['projectId']);
    const projectId = idSchema.parse(url.searchParams.get('projectId')); const snapshot = this.snapshot(projectId); if (!snapshot.ok) return this.response(snapshot);
    if (method === 'GET') { const job = this.core.job(this.options.ownerId, projectId, id!); return this.response(job ? { ok: true, revision: snapshot.revision, result: jobSchema.parse(job), diagnostics: [] } : failure('NOT_FOUND', 'Unknown job.', snapshot.revision)); }
    return this.response(await this.dispatch({ requestId: url.searchParams.get('requestId'), projectId, operation: 'job.cancel', expectedRevision: queryInteger(url.searchParams.get('expectedRevision'), 0, 1), input: { jobId: id } }));
   }
   return this.response(failure('NOT_FOUND', 'Unknown endpoint or method.'));
  } catch (error) {
   if (error instanceof StorageError) return this.response(failure(error.code === 'PAYLOAD_TOO_LARGE' ? 'INVALID_INPUT' : error.code, error.message), {}, error.code === 'PAYLOAD_TOO_LARGE' ? 413 : undefined);
   if (error instanceof z.ZodError || error instanceof URIError) return this.response(failure('INVALID_INPUT', 'Request does not match endpoint schema.'));
   return this.response(failure('RECOVERY_REQUIRED', 'Owner request failed; inspect recovery before retrying.'));
  }
 }
 close() { this.sessions.clear(); this.secrets.clear(); return this.core.close(); }
}
