import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
export interface ForwardOptions { ownerUrl: string; capability: string }
type Tool = { operation: string; inputSchema: { type: 'object'; [key: string]: unknown }; resultSchema: unknown };
type Envelope = { ok: boolean; revision: number; result?: unknown; error?: { code: string; message: string; retryable: boolean }; diagnostics: unknown[] };
/** Has no core/storage dependency. Only this authenticated owner connection can change state. */
export function createMcpServer(options: ForwardOptions): Server {
 const owner = new URL(options.ownerUrl);
 if (owner.protocol !== 'http:' || owner.hostname !== '127.0.0.1' || owner.pathname !== '/' || owner.search || owner.hash || owner.username || owner.password || options.capability.length < 32) throw new Error('Configure an authenticated IPv4 loopback owner URL.');
 const server = new Server({ name: 'schema-baron', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });
 async function request(path: string, body?: unknown): Promise<Envelope> {
  try {
   const response = await fetch(owner.origin + '/api/v1' + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${options.capability}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(15000) });
   return await response.json() as Envelope;
  } catch { return { ok: false, revision: 0, error: { code: 'RECOVERY_REQUIRED', message: 'Owner service is unavailable; start or reconnect Studio.', retryable: true }, diagnostics: [] }; }
 }
 async function capabilities(): Promise<{ operations: Tool[]; approvedRootIds: string[] }> {
  const result = await request('/capabilities');
  if (!result.ok) throw new McpError(ErrorCode.InternalError, 'Owner capability discovery failed.');
  return result.result as { operations: Tool[]; approvedRootIds: string[] };
 }
 const unknown = (): Envelope => ({ ok: false, revision: 0, error: { code: 'INVALID_INPUT', message: 'Operation is not available.', retryable: false }, diagnostics: [] });
 const toolResult = (outcome: Envelope) => ({ isError: !outcome.ok, structuredContent: outcome, content: [{ type: 'text' as const, text: JSON.stringify(outcome) }] });
 server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: (await capabilities()).operations.map(tool => ({ name: tool.operation.replaceAll('.', '_'), description: `Owner operation ${tool.operation}`, inputSchema: tool.inputSchema })) }));
 server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const discovery = await request('/capabilities'); if (!discovery.ok) return toolResult(discovery);
  const tool = (discovery.result as { operations: Tool[] }).operations.find(tool => tool.operation.replaceAll('.', '_') === params.name);
  if (!tool) return toolResult(unknown());
  const args = params.arguments ?? {};
  // Operation is fixed by the tool name. Unknown properties still reach the owner's strict schema.
  if ('operation' in args) return toolResult(unknown());
  const projectId = args.projectId;
  if (typeof projectId !== 'string' || !projectId.length) return toolResult(unknown());
  return toolResult(await request(`/projects/${encodeURIComponent(projectId)}/commands`, { ...args, operation: tool.operation }));
 });
 server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [
  { uriTemplate: 'schema-baron://projects/{projectId}/snapshot', name: 'Project snapshot', mimeType: 'application/json' },
  { uriTemplate: 'schema-baron://projects/{projectId}/diagnostics', name: 'Project diagnostics', mimeType: 'application/json' },
  { uriTemplate: 'schema-baron://projects/{projectId}/jobs/{jobId}', name: 'Job status', mimeType: 'application/json' },
 ] }));
 server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: { uri: string; name: string; mimeType: string }[] = [];
  for (const root of (await capabilities()).approvedRootIds) {
   const projects = await request('/projects?approvedRoot=' + encodeURIComponent(root));
   if (!projects.ok) continue;
   for (const project of projects.result as { id: string; name: string }[]) for (const kind of ['snapshot', 'diagnostics']) resources.push({ uri: `schema-baron://projects/${encodeURIComponent(project.id)}/${kind}`, name: `${project.name} ${kind}`, mimeType: 'application/json' });
  }
  return { resources };
 });
 server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
  let url: URL; try { url = new URL(params.uri); } catch { throw new McpError(ErrorCode.InvalidParams, 'Invalid resource URI.'); }
  if (url.protocol !== 'schema-baron:' || url.hostname !== 'projects' || url.username || url.password || url.port || url.search || url.hash) throw new McpError(ErrorCode.InvalidParams, 'Unknown resource.');
  const parts = url.pathname.slice(1).split('/'); const [projectId, kind, jobId] = parts;
  if (!projectId) throw new McpError(ErrorCode.InvalidParams, 'Project ID is required.');
  let path: string;
  if (parts.length === 2 && kind === 'snapshot') path = `/projects/${projectId}`;
  else if (parts.length === 2 && kind === 'diagnostics') path = `/projects/${projectId}/diagnostics`;
  else if (parts.length === 3 && kind === 'jobs' && jobId) path = `/jobs/${jobId}?projectId=${projectId}`;
  else throw new McpError(ErrorCode.InvalidParams, 'Unknown resource.');
  return { contents: [{ uri: params.uri, mimeType: 'application/json', text: JSON.stringify(await request(path)) }] };
 });
 return server;
}
