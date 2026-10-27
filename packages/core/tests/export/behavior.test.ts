import { test, expect } from 'vitest';
import { readdirSync, readFileSync, lstatSync, symlinkSync, mkdtempSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { authored } from '../runtime/fixture.js';
function files(path: string): string[] {
  return readdirSync(path).flatMap(name => {
    const child = join(path, name);
    return lstatSync(child).isDirectory() ? files(child) : [child];
  });
}
test('default portable export excludes data, credentials, absolute locators and runtime artifacts; reviewed snapshot is consistent', async () => {
  const f = await authored();
  try {
    await f.run('project.export', {
      destination: 'output:default'
    });
    const directory = join(f.output, 'default'),
      paths = files(directory);
    expect(paths.every(p => !p.endsWith('.sqlite'))).toBe(true);
    const content = paths.map(p => readFileSync(p, 'utf8')).join('\n');
    expect(content).not.toContain(f.root);
    expect(content).not.toContain('Original');
    expect(content).not.toContain('scrypt$1$');
    expect(paths.every(p => !p.includes('node_modules') && !p.includes('.next/'))).toBe(true);
    const definition = JSON.parse(readFileSync(join(directory, 'project.json'), 'utf8'));
    expect(definition.connections[0].locator).toEqual({
      approvedRootId: 'portable',
      relativePath: 'data/application.sqlite'
    });
    await expect(f.run('project.export', {
      destination: 'output:default'
    })).rejects.toThrow('OUTPUT_CONFLICT');
    await f.run('project.export', {
      destination: 'output:with-data',
      includeData: true
    });
    const db = new Database(join(f.output, 'with-data/data/application.sqlite'), {
      readonly: true
    });
    expect(db.prepare('SELECT caption FROM records').get()).toEqual({
      caption: 'Original'
    });
    expect(db.pragma('integrity_check', {
      simple: true
    })).toBe('ok');
    db.close();
    const outside = mkdtempSync(join(tmpdir(), 'wp21-export-outside-'));
    symlinkSync(outside, join(f.output, 'escape'));
    await expect(f.run('project.export', {
      destination: 'output:escape/copy'
    })).rejects.toThrow('PATH_OUTSIDE_ROOT');
    await expect(f.run('project.export', {
      destination: 'output:../outside'
    })).rejects.toThrow('PATH_OUTSIDE_ROOT');
  } finally {
    await f.core.close();
  }
});
test('mapped credential data is explicitly refused, preserving relational schema/data', async () => {
  const f = await authored();
  try {
    // Identity configuration is validated through the canonical command. The existing
    // business table lacks a password field, so construct a compatible inspected table.
    const db = new Database(join(f.definitions, 'records.sqlite'));
    db.exec('CREATE TABLE identities(id TEXT PRIMARY KEY NOT NULL,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL)');
    db.close();
    const snapshot = f.core.snapshot('owner', f.id);
    const inspected = await f.run('connection.inspect', {
      approvedPath: 'projects:records.sqlite',
      mode: 'read-only',
      connectionId: snapshot.connections[0]!.id
    });
    await f.run('connection.bind', {
      connectionId: inspected.connection.id,
      fingerprint: inspected.connection.fingerprint
    });
    const table = f.core.snapshot('owner', f.id).schema.tables.find(t => t.physicalName === 'identities')!;
    await f.run('identity.configure', {
      kind: 'mapped',
      tableId: table.id,
      userIdColumnId: table.columns[0]!.id,
      usernameColumnId: table.columns[1]!.id,
      passwordHashColumnId: table.columns[2]!.id
    });
    await expect(f.run('project.export', {
      destination: 'output:unsafe',
      includeData: true
    })).rejects.toThrow('password hashes cannot be copied');
    const after = new Database(join(f.definitions, 'records.sqlite'));
    expect(after.prepare('SELECT caption FROM records').get()).toEqual({
      caption: 'Original'
    });
    expect(after.prepare('PRAGMA table_info(identities)').all()).toHaveLength(3);
    after.close();
  } finally {
    await f.core.close();
  }
});
test('export parent swap during real SQLite snapshot cannot publish into the replacement', async () => {
  const f = await authored();
  const outside = mkdtempSync(join(tmpdir(), 'wp21-export-race-'));
  try {
    const parent = join(f.output, 'exports');
    mkdirSync(parent);
    const exporting = f.run('project.export', {
      destination: 'output:exports/portable',
      includeData: true
    });
    // executeAsync reserves before entering its handler; allow its first asynchronous
    // SQLite inspection to begin, then race only the selected destination parent.
    await new Promise(resolve => setImmediate(resolve));
    renameSync(parent, parent + '-original');
    symlinkSync(outside, parent);
    await expect(exporting).rejects.toThrow('PATH_OUTSIDE_ROOT');
    expect(readdirSync(outside)).toEqual([]);
    expect(readdirSync(parent + '-original')).toEqual([]);
  } finally {
    await f.core.close();
  }
});
