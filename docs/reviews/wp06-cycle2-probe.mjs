// Independent public-interface approval probe; desired behavior assertions.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '@schema-baron/core';
const root = mkdtempSync(join(tmpdir(), 'wp06-cycle2-review-'));
const options = { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'databases') } };
const core = new ProjectCore(options);
const cmd = (projectId, requestId, operation, input, expectedRevision = 1) => ({ projectId, requestId, operation, input, expectedRevision });
const inspect = (file, key, projectId = 'p') => cmd(projectId, key, 'connection.inspect', { approvedPath: `projects:${file}`, mode: 'read-only', createEmpty: true });
const has = name => existsSync(join(root, 'databases', name));
try {
  for (const projectId of ['p', 'q']) assert.equal(core.execute('owner', cmd(projectId, 'create', 'project.create', { name: projectId, approvedRoot: 'projects', target: 'next-typescript-sqlite' }, 0)).ok, true);
  for (const stage of ['before-handler', 'worker-active']) {
    const matchingFile = `${stage}-matching.sqlite`;
    const request = inspect(matchingFile, `${stage}-matching`);
    const events = core.events('owner', 'p', 0);
    assert.equal(has(matchingFile), false);
    const first = core.executeAsync('owner', request);
    if (stage === 'worker-active') { await Promise.resolve(); assert.equal(has(matchingFile), true); }
    const pair = await Promise.all([first, core.executeAsync('owner', structuredClone(request))]);
    assert(pair.every(result => result.ok)); assert.deepEqual(pair[0], pair[1]);
    assert.deepEqual(await core.executeAsync('owner', request), pair[0]);
    assert.equal(core.operation('owner', 'p', request.requestId).outcome, 'committed');
    assert.equal(readdirSync(join(root, 'databases')).filter(name => name === matchingFile).length, 1);
    assert.deepEqual(core.events('owner', 'p', 0), events);
    const winnerFile = `${stage}-winner.sqlite`, loserFile = `${stage}-loser.sqlite`;
    const winner = inspect(winnerFile, `${stage}-conflict`), loser = inspect(loserFile, winner.requestId);
    const winning = core.executeAsync('owner', winner);
    if (stage === 'worker-active') { await Promise.resolve(); assert.equal(has(winnerFile), true); }
    const conflict = await core.executeAsync('owner', loser);
    assert.equal(conflict.error.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(has(loserFile), false);
    assert.equal((await winning).ok, true); assert.equal(has(winnerFile), true);
    assert.equal((await core.executeAsync('owner', loser)).error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(core.snapshot('owner', 'p').revision, 1);
    console.log(JSON.stringify({ stage, matching: 'one success/record/replay', conflicting: 'winner only; loser absent', revision: 1 }));
  }
  const request = inspect('mixed.sqlite', 'mixed'); const pending = core.executeAsync('owner', request);
  const sync = core.execute('owner', request); assert.equal(sync.error.code, 'PROJECT_BUSY'); assert.equal(sync.error.retryable, true);
  assert.equal(core.execute('owner', inspect('mixed-loser.sqlite', 'mixed')).error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(core.operation('owner', 'p', 'mixed'), undefined);
  assert.equal((await core.executeAsync('intruder', request)).error.code, 'ACCESS_DENIED');
  const independent = await core.executeAsync('owner', inspect('q.sqlite', 'mixed', 'q')); assert.equal(independent.ok, true);
  const completed = await pending; assert.equal(completed.ok, true); assert.equal(has('mixed-loser.sqlite'), false);
  assert.deepEqual(core.execute('owner', request), completed);
  const record = core.operation('owner', 'p', 'mixed'); await core.close();
  const reopened = new ProjectCore(options);
  try { assert.deepEqual(await reopened.executeAsync('owner', request), completed); assert.deepEqual(reopened.operation('owner', 'p', 'mixed'), record); assert.equal(reopened.snapshot('owner', 'p').revision, 1); }
  finally { await reopened.close(); }
  console.log(JSON.stringify({ mixedSync: 'retryable busy; no poisoning', unauthorized: 'access denied', projectIsolation: 'same key succeeds in q', reopen: 'same durable result/record' }));
} finally { await core.close(); rmSync(root, { recursive: true, force: true }); }
