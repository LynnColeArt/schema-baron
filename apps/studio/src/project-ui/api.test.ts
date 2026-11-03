import { afterEach, expect, test, vi } from "vitest";
import { StudioClient } from "./api.js";
afterEach(() => vi.unstubAllGlobals());
const diagnostic = {
  code: "VALIDATION_FAILED",
  severity: "error",
  message: "Route is duplicated.",
};
test("a later committed revision supersedes replayed validation errors", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        `id: 2\nevent: diagnostic\ndata: ${JSON.stringify({ sequence: 2, revision: 1, diagnostics: [diagnostic] })}\n\nid: 3\nevent: revision\ndata: {"sequence":3,"revision":2,"diagnostics":[]}\n\nevent: replay-complete\ndata: {"lastSequence":3}\n\n`,
      ),
  );
  expect(await new StudioClient().events("project", 1)).toEqual({
    lastSequence: 3,
    refetch: false,
    diagnostics: [],
  });
});
test("event gaps discard tentative diagnostics and require authoritative snapshot refetch", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        `id: 4\nevent: diagnostic\ndata: ${JSON.stringify({ sequence: 4, revision: 2, diagnostics: [diagnostic] })}\n\n`,
      ),
  );
  expect(await new StudioClient().events("project", 1)).toEqual({
    lastSequence: 4,
    refetch: true,
    diagnostics: [],
  });
});
test('stale tab CSRF proof refreshes the session and retries the identical command once', async () => {
 const calls: { path: string; init: RequestInit }[] = [];
 vi.stubGlobal('fetch', async (path: string, init: RequestInit) => {
  calls.push({ path, init });
  if (calls.length === 1) return Response.json({ ok: false, error: { code: 'ACCESS_DENIED', message: 'Browser write requires CSRF proof.' } }, { status: 403 });
  if (path.endsWith('/session')) return Response.json({ ok: true, result: { csrfToken: 'current-proof' } });
  return Response.json({ ok: true, result: { saved: true } });
 });
 const client = new StudioClient(); client.csrf = 'old-proof';
 expect(await client.read('projects/example/commands', { requestId: 'same-request', operation: 'project.batch' })).toEqual({ saved: true });
 expect(calls).toHaveLength(3); expect(calls[2]!.init.body).toBe(calls[0]!.init.body);
 expect(calls[2]!.init.headers).toMatchObject({ 'x-csrf-token': 'current-proof' });
});
test('session recovery is bounded when a write still rejects the refreshed proof', async () => {
 let calls = 0;
 vi.stubGlobal('fetch', async (path: string) => {
  calls++;
  return path.endsWith('/session') ? Response.json({ ok: true, result: { csrfToken: 'current-proof' } }) : Response.json({ ok: false, error: { code: 'ACCESS_DENIED', message: 'Browser write requires CSRF proof.' } }, { status: 403 });
 });
 const client = new StudioClient(); client.csrf = 'old-proof';
 await expect(client.read('projects/example/commands', {})).rejects.toThrow('CSRF proof');
 expect(calls).toBe(3);
});
