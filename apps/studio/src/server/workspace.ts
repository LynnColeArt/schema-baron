import { createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { safePath, StorageError } from '@schema-baron/storage';
import type { ProjectCore } from '@schema-baron/core';
import { idSchema } from '@schema-baron/model';
import { z } from 'zod';

const settingsSchema = z.strictObject({
 projectsFolder: z.string().min(1), configured: z.boolean(),
 databaseRoots: z.record(z.string(), z.string()).default({}),
 projects: z.record(z.string(), z.strictObject({ name: z.string(), rootId: z.string(), directory: z.string() })),
});
/** Workspace preferences are private local state, independent of project definitions. */
export class LocalWorkspace {
 private state: z.infer<typeof settingsSchema>;
 constructor(private file: string, private home = homedir()) {
  this.file = safePath(dirname(file), file);
  this.state = existsSync(this.file) ? settingsSchema.parse(JSON.parse(readFileSync(this.file, 'utf8'))) : {
   projectsFolder: join(home, 'projects', 'schema-baron'), configured: false, projects: {}, databaseRoots: {},
  };
 }
 get roots(): Record<string, string> { return { ...this.state.databaseRoots, ...Object.fromEntries(Object.values(this.state.projects).map(p => [p.rootId, p.directory])) }; }
 settings() { return { projectsFolder: this.state.projectsFolder, configured: this.state.configured }; }
 private persist(next: typeof this.state) {
  mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
  const temporary = `${this.file}.${randomBytes(8).toString('hex')}.tmp`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
  renameSync(temporary, this.file);
  const parent = openSync(dirname(this.file), 'r');
  try { fsyncSync(parent); } finally { closeSync(parent); }
  this.state = next;
 }
 save(projectsFolder: string) {
  const supplied = projectsFolder.trim();
  const expanded = supplied === '~' ? this.home : supplied.startsWith('~/') ? join(this.home, supplied.slice(2)) : supplied;
  if (!isAbsolute(expanded)) throw new StorageError('INVALID_INPUT', 'Choose an absolute projects folder, or a path beginning with ~/.');
  const directory = safePath(resolve(expanded), '.');
  // Check writability without adopting or modifying an existing project.
  const probe = join(directory, `.schema-baron-workspace-${randomBytes(8).toString('hex')}`);
  try {
   mkdirSync(directory, { recursive: true });
   writeFileSync(probe, '', { flag: 'wx', mode: 0o600 });
   unlinkSync(probe);
  } catch { throw new StorageError('INVALID_INPUT', 'Studio cannot write to that folder. Choose a writable projects folder.'); }
  this.persist({ ...this.state, projectsFolder: directory, configured: true });
  return this.settings();
 }
 approveDatabase(path: string, core: ProjectCore) {
  const directory = safePath(dirname(path), '.');
  const id = `database-${createHash('sha256').update(directory).digest('hex')}`;
  core.addApprovedRoot(id, directory);
  if (!Object.hasOwn(this.state.databaseRoots, id)) this.persist({ ...this.state, databaseRoots: { ...this.state.databaseRoots, [id]: directory } });
  return id;
 }
 project(name: string, requestId: string, core: ProjectCore, projectsFolder?: string) {
  if (!this.state.configured) throw new StorageError('INVALID_INPUT', 'Finish workspace setup before creating a project.');
  if (!idSchema.safeParse(requestId).success) throw new StorageError('INVALID_INPUT', 'Invalid project identity.');
  if (!name.trim() || name !== name.trim() || name.length > 120 || /[\\/\x00-\x1f<>:"|?*]/.test(name) || name.endsWith('.') || ['.', '..'].includes(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
   throw new StorageError('INVALID_INPUT', 'Use a project name suitable for a single folder, without slashes or reserved characters.');
  const previous = Object.hasOwn(this.state.projects, requestId) ? this.state.projects[requestId] : undefined;
  if (previous && previous.name !== name) throw new StorageError('IDEMPOTENCY_CONFLICT', 'This creation request already belongs to another project name.');
  if (previous) { core.addApprovedRoot(previous.rootId, previous.directory); return previous.rootId; }
  const supplied = projectsFolder?.trim() ?? this.state.projectsFolder;
  const expanded = supplied.startsWith('~/') ? join(this.home, supplied.slice(2)) : supplied;
  if (!isAbsolute(expanded)) throw new StorageError('INVALID_INPUT', 'Choose an absolute project location or a ~/ path.');
  const parent = safePath(resolve(expanded), '.');
  mkdirSync(parent, { recursive: true });
  const directory = safePath(parent, name);
  try { mkdirSync(directory); }
  catch (error) {
   if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new StorageError('INVALID_INPUT', 'That project folder already exists. Choose another project name; existing folders are never overwritten.');
   throw error;
  }
  const rootId = `project-${createHash('sha256').update(requestId).digest('hex')}`;
  // Initial source promotion requires an existing parent, outside the database.
  mkdirSync(join(directory, 'generated'));
  this.persist({ ...this.state, projects: { ...this.state.projects, [requestId]: { name, rootId, directory } } });
  core.addApprovedRoot(rootId, directory);
  return rootId;
 }
}

/** No manual key provisioning is needed to start the local Studio. MCP retains a private credential. */
export function defaultOwnerConfig(file: string) {
 const path = safePath(dirname(file), file);
 if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
 mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
 const config = { ownerId: 'schema-baron-studio', capability: randomBytes(32).toString('base64url'), metadataRoot: join(dirname(path), 'metadata'), approvedRoots: {} };
 writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
 return config;
}
