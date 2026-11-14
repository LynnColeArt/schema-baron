import { describe, expect, it } from 'vitest';
import { createId } from '@schema-baron/model';
import { applicableSchemaBuffers, blankTable, changeTable, checkpointDrafts, reconcileDrafts, tableOperations } from './state.js';
describe('schema drafts', () => {
  it('only validates buffers for live fields of the desired logical types, including unselected columns', () => {
    const decimal = (name: string) => ({ id: createId(() => name), physicalName: name, nullable: false, type: { kind: 'decimal' as const, scale: 2, precision: 18, encoding: 'text' as const, rounding: 'half-even' as const } });
    const cost = decimal('cost'), reserve = decimal('reserve');
    const table = { ...blankTable(), columns: [{ ...cost, type: { kind: 'integer' as const } }, reserve] };
    expect(applicableSchemaBuffers({ cost: '-', 'cost:scale': '-', 'cost:precision': '1e', 'reserve:scale': '-', 'reserve:precision': '1e', 'removed:scale': '-', removed: '-' }, [table])).toEqual({ cost: '-', 'reserve:scale': '-', 'reserve:precision': '1e' });
    expect(applicableSchemaBuffers({ 'reserve:scale': '-' }, [{ ...table, columns: [] }])).toEqual({});
  });
  it('an explicit type transition retires old numeric text without erasing another decimal draft; undo keeps model numbers', () => {
    const cost = { id: createId(() => 'cost'), physicalName: 'cost', nullable: false, type: { kind: 'decimal' as const, scale: 2, precision: 18, encoding: 'text' as const, rounding: 'half-even' as const } };
    const reserve = { ...cost, id: createId(() => 'reserve'), physicalName: 'reserve' };
    const table = { ...blankTable(), columns: [cost, reserve] };
    const buffers = { 'cost:scale': '-', 'cost:precision': '1e', 'reserve:scale': '-' };
    const changed = { ...table, columns: [{ ...cost, type: { kind: 'integer' as const } }, reserve] };
    const retained = applicableSchemaBuffers(buffers, [changed]);
    expect(retained).toEqual({ 'reserve:scale': '-' });
    expect(applicableSchemaBuffers(retained, [table])).toEqual({ 'reserve:scale': '-' });
    expect(table.columns[0]!.type).toMatchObject({ kind: 'decimal', scale: 2, precision: 18 });
  });
  it('merges a later unrelated service edit when checkpointing a save',()=>{const table={...blankTable(),physicalName:'submitted'};const submitted=changeTable({},[],table);const current=changeTable(submitted,[],{...table,physicalName:'typed during save'});const remote={...table,indexes:[{id:createId(),physicalName:'later_index',columnIds:[],unique:false}]};const next=checkpointDrafts(current,submitted,[remote]);expect(next[table.id]!.value!.physicalName).toBe('typed during save');expect(next[table.id]!.value!.indexes).toEqual(remote.indexes);expect(next[table.id]!.conflicts).toEqual([]);});
  it('retains edits typed while its new table save is in flight', () => {
    const table = {
      ...blankTable(),
      physicalName: 'submitted'
    };
    const submitted = changeTable({}, [], table);
    const current = changeTable(submitted, [], {
      ...table,
      physicalName: 'typed while saving'
    });
    const next = checkpointDrafts(current, submitted, [table]);
    expect(next[table.id]!.value!.physicalName).toBe('typed while saving');
    expect(next[table.id]!.base).toEqual(table);
    expect(next[table.id]!.conflicts).toEqual([]);
  });
  it('retains invalid names and stable identity until explicit commit', () => {
    const table = blankTable();
    const drafts = changeTable({}, [], {
      ...table,
      physicalName: ''
    });
    expect(drafts[table.id]!.value!.physicalName).toBe('');
    expect(drafts[table.id]!.value!.id).toBe(table.id);
    expect(tableOperations(drafts)[0]).toMatchObject({
      kind: 'put',
      id: table.id
    });
  });
  it('merges unrelated service changes and retains colliding edits for a choice', () => {
    const table = {
      ...blankTable(),
      physicalName: 'before'
    };
    let drafts = changeTable({}, [table], {
      ...table,
      physicalName: 'local'
    });
    const remote = {
      ...table,
      indexes: [{
        id: createId(),
        physicalName: 'index',
        columnIds: [],
        unique: false
      }]
    };
    drafts = reconcileDrafts(drafts, [remote]);
    expect(drafts[table.id]!.value!.indexes).toEqual(remote.indexes);
    expect(drafts[table.id]!.conflicts).toEqual([]);
    drafts = reconcileDrafts(drafts, [{
      ...remote,
      physicalName: 'remote'
    }]);
    expect(drafts[table.id]!.value!.physicalName).toBe('local');
    expect(drafts[table.id]!.conflicts).toContain('physicalName');
  });
  it('recognizes a committed draft despite schema normalization property order', () => {
    const table = blankTable();
    const value = {
      ...table,
      physicalName: 'saved'
    };
    const drafts = changeTable({}, [], value);
    const {
      physicalName,
      ...rest
    } = value;
    expect(reconcileDrafts(drafts, [{
      physicalName,
      ...rest
    }])).toEqual({});
  });
  it('preserves twenty independent drafts through selection-neutral rebase', () => {
    const tables = Array.from({
      length: 50
    }, () => blankTable());
    let drafts = {};
    for (const table of tables.slice(0, 20)) drafts = changeTable(drafts, tables, {
      ...table,
      physicalName: 'edited'
    });
    expect(Object.keys(reconcileDrafts(drafts, tables))).toHaveLength(20);
  });
});
