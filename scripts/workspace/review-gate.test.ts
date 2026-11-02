import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectReviewCheckout, runReviewCommand } from './review-gate.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'baron-review-preflight-test-')); roots.push(root);
  for (const directory of ['apps/studio', 'apps/mcp', 'packages/generator']) {
    mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, directory, 'package.json'), JSON.stringify({ name: `@schema-baron/${directory.split('/')[1]}`, exports: { '.': { default: './dist/index.js' } } }));
  }
  return root;
}
function file(root: string, path: string) { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), 'fixture'); }
function dependencies(root: string) {
  file(root, 'node_modules/vitest/vitest.mjs');
  file(root, 'node_modules/typescript/bin/tsc');
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
  symlinkSync('../vitest/vitest.mjs', join(root, 'node_modules/.bin/vitest'));
  symlinkSync('../typescript/bin/tsc', join(root, 'node_modules/.bin/tsc'));
  mkdirSync(join(root, 'node_modules/@schema-baron'), { recursive: true });
  for (const directory of ['apps/studio', 'apps/mcp', 'packages/generator']) symlinkSync(join(root, directory), join(root, 'node_modules/@schema-baron', directory.split('/')[1]!));
}

test('cold checkout is unprepared and only complete local runtime artifacts are ready', () => {
  const root = fixture();
  expect(inspectReviewCheckout(root)).toEqual({ dependenciesReady: false, artifactsReady: false });
  dependencies(root);
  for (const path of ['apps/studio/dist/main.js', 'apps/mcp/dist/main.js', 'apps/studio/.next/BUILD_ID', 'packages/generator/dist/templates/base/package-lock.template', 'packages/generator/dist/templates/auth/store.template', 'apps/studio/dist/index.js', 'apps/mcp/dist/index.js', 'packages/generator/dist/index.js']) file(root, path);
  expect(inspectReviewCheckout(root)).toEqual({ dependenciesReady: true, artifactsReady: true });
  rmSync(join(root, 'apps/studio/.next/BUILD_ID'));
  expect(inspectReviewCheckout(root).artifactsReady).toBe(false);
});

test('borrowed dependency root is refused without changing its contents', () => {
  const root = fixture(), borrowed = fixture();
  file(borrowed, 'sentinel'); symlinkSync(borrowed, join(root, 'node_modules'));
  expect(() => inspectReviewCheckout(root)).toThrow('borrowed or symlinked node_modules');
  expect(readFileSync(join(borrowed, 'sentinel'), 'utf8')).toBe('fixture');
});

test('workspace links cannot resolve into another checkout', () => {
  const root = fixture(), other = fixture(); dependencies(root);
  rmSync(join(root, 'node_modules/@schema-baron/studio'));
  symlinkSync(join(other, 'apps/studio'), join(root, 'node_modules/@schema-baron/studio'));
  expect(() => inspectReviewCheckout(root)).toThrow('resolved outside this checkout');
});

test('local-looking package executable cannot escape to another installation', () => {
  const root = fixture(), other = fixture(); dependencies(root); dependencies(other);
  rmSync(join(root, 'node_modules/.bin/vitest'));
  symlinkSync(join(other, 'node_modules/vitest/vitest.mjs'), join(root, 'node_modules/.bin/vitest'));
  expect(() => inspectReviewCheckout(root)).toThrow('borrowed package executable');
});

test('borrowed compiled artifact is refused before a rebuild can write through it', () => {
  const root = fixture(), other = fixture();
  file(other, 'compiled/main.js'); mkdirSync(join(root, 'apps/studio/dist'), { recursive: true });
  symlinkSync(join(other, 'compiled/main.js'), join(root, 'apps/studio/dist/main.js'));
  expect(() => inspectReviewCheckout(root)).toThrow('borrowed runtime artifact');
  expect(readFileSync(join(other, 'compiled/main.js'), 'utf8')).toBe('fixture');
});

test('real failing child exit is retained instead of reported as a green stage', () => {
  try { runReviewCommand(process.execPath, ['-e', 'process.exit(23)'], { stdio: 'pipe' }); throw Error('unexpected success'); }
  catch (error) { expect(error).toHaveProperty('status', 23); }
  expect(() => runReviewCommand(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'pipe' })).not.toThrow();
});
