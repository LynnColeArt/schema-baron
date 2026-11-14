import { test, expect } from '@playwright/test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { workshopJourney } from './workshop-journey.js';
import { libraryJourney } from './library-journey.js';
import { startIsolatedStudio } from './helpers.js';
import type { AccessFixture } from './access-contract.js';
import { crossProjectCode, customizeAndRegenerate, exportPair, identities, processIdentity, revision, sha } from './portability.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(1800000);
for (const [name, journey] of [['workshop', workshopJourney], ['library', libraryJourney]] as const) {
 test(name + ' authored code follows configured output and survives regeneration', async ({ page, browser }, info) => {
  const handoff = process.env.SCHEMA_BARON_PORTABILITY_HANDOFF;
  expect(handoff, 'Set a fresh private SCHEMA_BARON_PORTABILITY_HANDOFF for both phases').toBeTruthy();
  expect(isAbsolute(handoff!)).toBe(true); expect(resolve(handoff!).startsWith(resolve('.') + '/')).toBe(false);
  mkdirSync(handoff!, { recursive: true, mode: 0o700 }); chmodSync(handoff!, 0o700);
  const studio = await startIsolatedStudio('schema-baron-wp07-' + name + '-');
  const ownerIdentity = processIdentity(studio.child.pid!);
  const contexts: import('@playwright/test').BrowserContext[] = [];
  let fixture: AccessFixture | undefined, authored: { authoredHash: string; authoredPath: string } | undefined, exports: string[] | undefined;
  try {
   await journey(page, browser, info, studio, { onVisitor: context => contexts.push(context), populated: async f => {
    fixture = f; authored = await customizeAndRegenerate(page, f, studio, info);
   } });
   // The original journey remainder (including migration/report/lifecycle checks) must finish.
   expect(fixture).toBeDefined(); exports = await exportPair(page, fixture!, studio, info);
   await crossProjectCode(page, fixture!, studio);
  } finally { for (const context of contexts) await context.close(); await studio.stop(); }
  expect(studio.child.exitCode !== null || studio.child.signalCode !== null).toBe(true);
  const f = fixture!;
  writeFileSync(join(handoff!, name + '.json'), JSON.stringify({ revision: revision(), runId: handoff!.split('/').at(-1), name, fixtureHash: sha(readFileSync('fixtures/acceptance/' + name + '.json')), journeyHash: sha(readFileSync('tests/e2e/acceptance/' + name + '-journey.ts')), project: f.project, directory: f.directory, database: f.database, username: f.username, secret: f.secret, rows: f.rows(), identityHash: sha(JSON.stringify(identities(f))), ownerIdentity, ownerUrl: studio.url, ownerStopped: true, originalJourneyCompleted: true, exports, authored }, null, 2), { mode: 0o600, flag: 'wx' });
 });
}
