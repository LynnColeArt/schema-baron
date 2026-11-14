import { lstatSync } from 'node:fs';
import { OutputError, contentHash, manifestPath, readManifest, scanSource } from '@schema-baron/generator';
import { safePath, StorageError } from '@schema-baron/storage';
import type { ProjectStorage } from '@schema-baron/storage';
import type { Project } from '@schema-baron/model';
export interface CurrentOutput {
  outputLocator: string;
  outputTreeRevision: number;
  modelRevision: number;
  project: Project;
}
function inspectOutput(storage: ProjectStorage, projectId: string, roots: Record<string, string>, locator?: string) {
  const current = (storage.job(projectId, 'output-current') as {
    outcome?: {
      result?: CurrentOutput;
    };
  } | undefined)?.outcome?.result;
  if (!current) throw new StorageError('NOT_FOUND', 'Generate the application before building, running or exporting output.');
  if (locator && locator !== current.outputLocator) throw new StorageError('OUTPUT_CONFLICT', 'Select the current generated output locator.');
  const split = current.outputLocator.indexOf(':'),
    root = roots[current.outputLocator.slice(0, split)];
  if (!root || split < 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'Output approval is unavailable.');
  const path = safePath(root, current.outputLocator.slice(split + 1)),
    stat = lstatSync(path);
  if (!stat.isDirectory()) throw new StorageError('OUTPUT_CONFLICT', 'Generated output is unavailable.');
  const scan = scanSource(path),
    manifest = readManifest(scan, projectId),
    authority = (storage.job(projectId, 'output-' + contentHash(path)) as {
      outcome?: {
        result?: {
          manifestHash: string;
          outputTreeRevision: string;
        };
      };
    } | undefined)?.outcome?.result;
  if (!manifest || scan.entries.find(e => e.path === manifestPath)?.hash !== authority?.manifestHash || Number(authority?.outputTreeRevision) !== current.outputTreeRevision) throw new StorageError('OUTPUT_CONFLICT', 'Generated ownership or output revision changed; recover or generate output before continuing.');
  const authored = new Set(manifest.authoredContracts.map(c => c.relativePath));
  for (const entry of scan.entries) {
    if (entry.kind === 'runtime') continue;
    if (entry.kind !== 'file' || entry.path !== manifestPath && !authored.has(entry.path) && (!manifest.ownedFileHashes[entry.path] || entry.hash !== manifest.ownedFileHashes[entry.path])) throw new StorageError('OUTPUT_CONFLICT', 'Output has unknown, modified owned, or unsafe source. Resolve generation conflicts first.');
  }
  for (const name of [...Object.keys(manifest.ownedFileHashes), ...authored]) if (!scan.entries.some(e => e.path === name && e.kind === 'file')) throw new StorageError('OUTPUT_CONFLICT', 'Generated source is missing.');
  return {
    current,
    path,
    scan,
    manifest,
    identity: `${stat.dev}:${stat.ino}`
  };
}
export function outputAuthority(...args: Parameters<typeof inspectOutput>) {
  try {
    return inspectOutput(...args);
  } catch (error) {
    if (error instanceof OutputError) throw new StorageError(error.code, error.message);
    throw error;
  }
}
