// Independent review evidence, not a product test: exits successfully when the defect reproduces.
// Run from the checkout: node docs/reviews/wp06-idempotency-repro.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '@schema-baron/core';

const root = mkdtempSync(join(tmpdir(), 'wp06-independent-review-'));
const options = { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'databases') } };
const core = new ProjectCore(options);
const command = (operation, input, requestId, expectedRevision = 1) => ({ projectId: 'p', requestId, operation, input, expectedRevision });
const inspect = (file, requestId) => command('connection.inspect', { approvedPath: `projects:${file}`, mode: 'read-only', createEmpty: true }, requestId);
const files = names => Object.fromEntries(names.map(name => [name, existsSync(join(root, 'databases', name))]));
const summarize = outcome => outcome.ok ? { ok: true, revision: outcome.revision, locator: outcome.result.connection?.locator } : outcome;
try {
  assert.equal(core.execute('owner', command('project.create', { name: 'Independent WP06 review', approvedRoot: 'projects', target: 'next-typescript-sqlite' }, 'create', 0)).ok, true);
  console.log(JSON.stringify({ phase: 'before', files: files(['matching.sqlite', 'a.sqlite', 'b.sqlite']), revision: core.snapshot('owner', 'p').revision, operation: core.operation('owner', 'p', 'matching') ?? null }));
  const matching = inspect('matching.sqlite', 'matching');
  const matchingResults = await Promise.all([core.executeAsync('owner', matching), core.executeAsync('owner', matching)]);
  console.log(JSON.stringify({ phase: 'matching', results: matchingResults.map(summarize), files: files(['matching.sqlite']), revision: core.snapshot('owner', 'p').revision, operation: core.operation('owner', 'p', 'matching'), retry: summarize(await core.executeAsync('owner', matching)) }));
  assert(matchingResults.every(result => !result.ok && result.error.code === 'OUTPUT_CONFLICT'));
  assert.equal(files(['matching.sqlite'])['matching.sqlite'], true);
  const conflictingResults = await Promise.all([core.executeAsync('owner', inspect('a.sqlite', 'conflicting')), core.executeAsync('owner', inspect('b.sqlite', 'conflicting'))]);
  console.log(JSON.stringify({ phase: 'conflicting', results: conflictingResults.map(summarize), files: files(['a.sqlite', 'b.sqlite']), revision: core.snapshot('owner', 'p').revision, operation: core.operation('owner', 'p', 'conflicting') }));
  assert.equal(conflictingResults.filter(result => result.ok).length, 1);
  assert.equal(conflictingResults.filter(result => !result.ok && result.error.code === 'IDEMPOTENCY_CONFLICT').length, 1);
  assert.deepEqual(files(['a.sqlite', 'b.sqlite']), { 'a.sqlite': true, 'b.sqlite': true });
  const pending = core.executeAsync('owner', command('connection.inspect', { approvedPath: 'projects:a.sqlite', mode: 'read-only' }, 'closing'));
  await core.close();
  const closedResult = await pending;
  assert.equal(closedResult.ok, false);
  assert.equal(closedResult.error.code, 'RECOVERY_REQUIRED');
  const reopened = new ProjectCore(options);
  try {
    console.log(JSON.stringify({ phase: 'actual-worker-close', result: closedResult, revision: reopened.snapshot('owner', 'p').revision, connections: reopened.snapshot('owner', 'p').connections, operation: reopened.operation('owner', 'p', 'closing') ?? null }));
    assert.equal(reopened.snapshot('owner', 'p').revision, 1);
    assert.equal(reopened.operation('owner', 'p', 'closing'), undefined);
  } finally { await reopened.close(); }
} finally { await core.close(); rmSync(root, { recursive: true, force: true }); }
