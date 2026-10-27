import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type { CoreOptions } from '../../src/index.js';
import { ProjectCore } from '../../src/index.js';
import { createId } from '@schema-baron/model';
export async function authored(extra: Partial<CoreOptions> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'wp21-')),
    definitions = join(root, 'definitions'),
    output = join(root, 'output');
  mkdirSync(definitions);
  mkdirSync(output);
  const database = join(definitions, 'records.sqlite'),
    db = new Database(database);
  db.exec("CREATE TABLE records(code TEXT NOT NULL PRIMARY KEY,caption TEXT NOT NULL);INSERT INTO records VALUES('A','Original')");
  db.close();
  const core = new ProjectCore({
      ownerId: 'owner',
      metadataRoot: join(root, 'metadata'),
      approvedRoots: {
        projects: definitions,
        output
      },
      ...extra
    }),
    id = createId();
  let revision = 0;
  const run = async (operation: string, input: unknown) => {
    const result = await core.executeAsync('owner', {
      projectId: id,
      requestId: createId(),
      expectedRevision: revision,
      operation,
      input
    });
    if (!result.ok) throw Error(JSON.stringify(result));
    revision = result.revision;
    return result.result as any;
  };
  await run('project.create', {
    name: 'Bare Record output',
    approvedRoot: 'projects',
    target: 'next-typescript-sqlite'
  });
  const inspected = await run('connection.inspect', {
    approvedPath: 'projects:records.sqlite',
    mode: 'read-only'
  });
  await run('connection.bind', {
    connectionId: inspected.connection.id,
    fingerprint: inspected.connection.fingerprint
  });
  const record = createId(),
    saved = createId(),
    extension = createId();
  await run('project.batch', {
    operations: [{
      kind: 'put',
      entity: 'extension',
      id: extension,
      value: {
        id: extension,
        relativePath: 'authored/private-validator.ts',
        version: 1,
        kind: 'validator'
      }
    }, {
      kind: 'put',
      entity: 'page',
      id: record,
      value: {
        id: record,
        route: '/',
        title: 'Record',
        document: [],
        formIds: []
      }
    }, {
      kind: 'put',
      entity: 'page',
      id: saved,
      value: {
        id: saved,
        route: '/saved',
        title: 'Saved',
        document: [{
          kind: 'text',
          text: 'Complete'
        }],
        formIds: []
      }
    }]
  });
  const table = core.snapshot('owner', id).schema.tables[0]!;
  await run('form.construct', {
    pageId: record,
    kind: 'Record',
    source: {
      kind: 'table',
      id: table.id
    },
    fieldIds: table.columns.map(c => c.id),
    keyIds: table.primaryKey,
    actions: ['insert', 'update', 'cancel'],
    links: [],
    style: {
      label: 'Record'
    },
    actionDefinitions: [{
      operation: 'insert',
      success: {
        pageId: saved,
        keyMapping: [],
        filterMapping: []
      }
    }, {
      operation: 'update',
      success: {
        pageId: saved,
        keyMapping: [],
        filterMapping: []
      }
    }, {
      operation: 'cancel',
      destination: {
        pageId: saved,
        keyMapping: [],
        filterMapping: []
      }
    }]
  });
  const generate = async () => {
    const plan = await run('generation.preview', {
      target: 'next-typescript-sqlite',
      projectRevision: revision,
      outputRoot: 'output:app'
    });
    return run('generation.apply', {
      planId: plan.id,
      hash: plan.hash,
      acknowledgedImpactIds: plan.requiredAcknowledgementIds
    });
  };
  await generate();
  return {
    root,
    definitions,
    output,
    app: join(output, 'app'),
    core,
    run,
    id,
    record,
    saved,
    extension,
    generate
  };
}
export async function waitJob(f: Awaited<ReturnType<typeof authored>>, id: string) {
  for (let i = 0; i < 1200; i++) {
    const job = f.core.job('owner', f.id, id) as any;
    if (!['running', 'pending'].includes(job.status)) return job;
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('Job timeout');
}
