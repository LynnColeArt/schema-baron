import { closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, safePath, StorageError } from '@schema-baron/storage';
import type { ProjectStorage } from '@schema-baron/storage';
import { idSchema } from '@schema-baron/model';
import { SQLiteWorker } from '@schema-baron/sqlite';
import { contentHash, manifestPath } from '@schema-baron/generator';
import type { CommandHandler, CommandRegistry } from '../commands/index.js';
import { outputAuthority } from '../runtime/output.js';
import { connectionPath } from '../connections/index.js';
export function registerExport(registry: CommandRegistry, options: {
  approvedRoots: Record<string, string>;
  metadataRoot: string;
}, storage: ProjectStorage) {
  const definition: CommandHandler = (command, project) => {
    if (command.operation !== 'project.export' || !project) throw new StorageError('INVALID_INPUT', 'Open a project.');
    if (command.input.includeData || !command.input.destination.endsWith('.json')) throw new StorageError('INVALID_INPUT', 'Use executeAsync for a portable output directory export.');
    const split = command.input.destination.indexOf(':'),
      portable = structuredClone(project);
    if (split < 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'Use an approved root locator.');
    for (const connection of portable.connections) {
      connection.locator = {
        approvedRootId: idSchema.parse('portable'),
        relativePath: 'data/application.sqlite'
      };
      delete connection.secretRef;
    }
    portable.outputConfig = {
      approvedRootId: idSchema.parse('portable'),
      relativePath: 'app'
    };
    return {
      result: storage.export(project.id, command.input.destination.slice(0, split), command.input.destination.slice(split + 1), portable)
    };
  };
  let closed = false;
  const workers = new Set<SQLiteWorker>();
  registry.registerAsync('project.export', async (command, project) => {
    if (command.operation === 'project.export' && command.input.destination.endsWith('.json')) return definition(command, project);
    if (command.operation !== 'project.export' || !project) throw new StorageError('INVALID_INPUT', 'Open a project before exporting.');
    if (command.input.includeData && project.identity?.kind === 'mapped') throw new StorageError('ACCESS_DENIED', 'Include-data export is unavailable for mapped identity tables: password hashes cannot be copied as ordinary data, and removing identity rows or columns would damage relationships. Export without data and provision a separate identity source deliberately.');
    const split = command.input.destination.indexOf(':'),
      root = options.approvedRoots[command.input.destination.slice(0, split)];
    if (split < 1 || !root) throw new StorageError('PATH_OUTSIDE_ROOT', 'Choose an approvedRootId:new-directory export destination.');
    const locator = command.input.destination.slice(split + 1),
      destination = safePath(root, locator);
    if (destination === safePath(root, '.') || existsSync(destination)) throw new StorageError('OUTPUT_CONFLICT', 'Export requires an unused child directory in an approved root.');
    const output = outputAuthority(storage, project.id, options.approvedRoots, command.input.outputRoot);
    if (project.revision !== output.current.modelRevision || hash(project) !== hash(output.current.project)) throw new StorageError('REVISION_CONFLICT', 'Save and generate the current project before exporting its portable definition and output.');
    const inside = relative(output.path, destination);
    if (!inside || inside !== '..' && !inside.startsWith('..' + sep)) throw new StorageError('PATH_OUTSIDE_ROOT', 'Export must live outside generated output.');
    const parent = dirname(destination);
    safePath(root, relative(root, parent));
    const fd = openSync(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
      anchor = `/proc/${process.pid}/fd/${fd}`,
      parentStat = fstatSync(fd),
      stage = join(anchor, '.portable-' + randomUUID());
    mkdirSync(stage, {
      mode: 0o700
    });
    let published = false;
    try {
      const portable = structuredClone(project);
      portable.outputConfig = {
        approvedRootId: idSchema.parse('portable'),
        relativePath: 'app'
      };
      for (const connection of portable.connections) {
        connection.locator = {
          approvedRootId: idSchema.parse('portable'),
          relativePath: 'data/application.sqlite'
        };
        delete connection.secretRef;
      }
      const files = output.scan.entries.filter(e => e.kind === 'file').map(e => ({
        path: e.path,
        content: e.content!
      }));
      const connection = files.find(f => f.path === 'server/connection.ts')!;
      connection.content = "import 'server-only';\nimport {resolve} from 'node:path';\n// Portable deployment configuration; never consult Studio.\nexport const databasePath=resolve(process.env.APPLICATION_DATABASE_PATH??'../data/application.sqlite');\n";
      const readme = files.find(f => f.path === 'README.md')!;
      readme.content = readme.content.replace('APPLICATION_DATABASE_PATH may override the server-only configured external database path.', 'APPLICATION_DATABASE_PATH configures the portable database (default ../data/application.sqlite, relative to app/).');
      const manifest = JSON.parse(files.find(f => f.path === manifestPath)!.content) as {
        ownedFileHashes: Record<string, string>;
      };
      for (const f of files) if (manifest.ownedFileHashes[f.path]) manifest.ownedFileHashes[f.path] = contentHash(f.content);
      files.find(f => f.path === manifestPath)!.content = JSON.stringify(manifest, null, 2) + '\n';
      mkdirSync(join(stage, 'app'));
      mkdirSync(join(stage, 'data'));
      for (const file of files) {
        const path = join(stage, 'app', file.path);
        mkdirSync(dirname(path), {
          recursive: true
        });
        writeFileSync(path, file.content, {
          flag: 'wx',
          mode: 0o600
        });
      }
      writeFileSync(join(stage, 'project.json'), JSON.stringify(portable, null, 2) + '\n', {
        flag: 'wx',
        mode: 0o600
      });
      writeFileSync(join(stage, 'deployment.env.example'), 'APPLICATION_DATABASE_PATH=../data/application.sqlite\n# Supply deployment secrets through a private environment. No credentials are exported.\n', {
        flag: 'wx',
        mode: 0o600
      });
      writeFileSync(join(stage, 'PORTABLE.md'), `# Portable export\n\nDefinition: project.json; source and authored bytes: app/. Locator root portable is this directory. Studio metadata, runtime artifacts, identity stores, sessions, secrets and credentials are excluded.\n\n${command.input.includeData ? 'data/application.sqlite is an explicit consistent SQLite online snapshot of the connected business database. Protect it as private application data.' : 'No database data is included. Supply a compatible SQLite database at data/application.sqlite or set APPLICATION_DATABASE_PATH.'}\n\nFrom app/, use Node 24.22.1 and npm 11.19.1. Run npm ci --ignore-scripts, npm run typecheck, npm test, npm run build, then npm start -- --hostname 127.0.0.1 --port 3100. Dependencies can be installed with --offline when the pinned cache is populated; after installation typecheck/test/build/run require no Studio or network service. Do not enable lifecycle scripts automatically. Native NAPI artifacts are shipped by the pinned SQLite dependency.\n\nAPPLICATION_DATABASE_PATH is relative to the working directory or absolute at deployment. deployment.env.example contains placeholders only; configure private secrets externally. Managed visitor identity is a new empty adjacent store; no author capability becomes visitor identity. Provision new visitors separately before protected use. Mapped identity requires independently provisioned compatible records. The original identity store and its password hashes are never bundled.\n\nGenerated source remains owned; authored modules and their versioned manifest travel unchanged. Review authored code before explicitly running it. Runtime process jobs execute only after your build/run action.\n`, {
        flag: 'wx',
        mode: 0o600
      });
      if (command.input.includeData) {
        const c = project.connections[0]!;
        const database = connectionPath(options.approvedRoots, `${c.locator.approvedRootId}:${c.locator.relativePath}`, options.metadataRoot).path;
        const stat = lstatSync(database),
          worker = new SQLiteWorker(database);
        workers.add(worker);
        try {
          const observed = await worker.inspect();
          if (observed.fingerprint !== c.fingerprint) throw new StorageError('DATABASE_CHANGED', 'Database schema changed before data export.');
          await worker.backup(join(stage, 'data', 'application.sqlite'));
          const snapshot = new SQLiteWorker(join(stage, 'data', 'application.sqlite'));
          workers.add(snapshot);
          try {
            if ((await snapshot.inspect()).fingerprint !== c.fingerprint) throw new StorageError('DATABASE_CHANGED', 'Snapshot schema changed during export.');
          } finally {
            await snapshot.close();
            workers.delete(snapshot);
          }
          const current = connectionPath(options.approvedRoots, `${c.locator.approvedRootId}:${c.locator.relativePath}`, options.metadataRoot).path,
            after = lstatSync(current);
          if (after.dev !== stat.dev || after.ino !== stat.ino) throw new StorageError('DATABASE_CHANGED', 'Database file changed during snapshot export.');
        } finally {
          await worker.close();
          workers.delete(worker);
        }
      }
      if (closed) throw new StorageError('RECOVERY_REQUIRED', 'Owner closed during export; no destination was published.');
      // Revalidate both source and approved parent immediately before publication.
      const current = outputAuthority(storage, project.id, options.approvedRoots);
      if (current.identity !== output.identity || current.scan.fingerprint !== output.scan.fingerprint) throw new StorageError('OUTPUT_CONFLICT', 'Output source changed during export.');
      safePath(root, locator);
      const parentNow = lstatSync(parent);
      if (parentNow.dev !== parentStat.dev || parentNow.ino !== parentStat.ino) throw new StorageError('PATH_OUTSIDE_ROOT', 'Export parent changed during snapshot.');
      // mkdir is exclusive: never replace an existing or newly raced destination.
      mkdirSync(join(anchor, basename(destination)), {
        mode: 0o700
      });
      const reservation = lstatSync(join(anchor, basename(destination)));
      try {
        if (lstatSync(join(anchor, basename(destination))).ino !== reservation.ino) throw new StorageError('OUTPUT_CONFLICT', 'Export destination changed.');
        renameSync(stage, join(anchor, basename(destination)));
        published = true;
        fsyncSync(fd);
      } catch (error) {
        if (lstatSync(join(anchor, basename(destination))).ino === reservation.ino) rmSync(join(anchor, basename(destination)));
        throw error;
      }
      return {
        result: {
          destination: command.input.destination,
          modelHash: hash(portable),
          includedData: command.input.includeData ?? false
        }
      };
    } finally {
      if (!published) rmSync(stage, {
        recursive: true,
        force: true
      });
      closeSync(fd);
    }
  }, definition);
  return async () => {
    closed = true;
    await Promise.all([...workers].map(worker => worker.close()));
  };
}
