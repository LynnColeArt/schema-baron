import { getOwner } from '../../../../src/server/runtime.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request): Promise<Response> { try { return await getOwner().handleNext(request); } catch { return Response.json({ ok: false, revision: 0, error: { code: 'RECOVERY_REQUIRED', message: 'Owner service is unavailable; use the documented Studio start command.', retryable: true }, diagnostics: [] }, { status: 503 }); } }
export { handle as GET, handle as POST, handle as DELETE, handle as PUT, handle as PATCH, handle as OPTIONS };
