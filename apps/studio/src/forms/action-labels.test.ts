import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createId, parseProject } from '@schema-baron/model';
import type { Action } from '@schema-baron/model';
import { actionChoiceLabel } from './action-labels.js';
const project = parseProject(JSON.parse(readFileSync(new URL('../../../../fixtures/model/project.json', import.meta.url), 'utf8')));
const destination = { pageId: project.pages[0]!.id, keyMapping: [], filterMapping: [] };
const action: Action = { id: createId(), formId: project.forms[0]!.id, operation: 'navigate', destination };
it('distinguishes same-operation destinations with ordered human field mappings while retaining stable identities', () => {
 const scoped: Action = { ...action, destination: { ...destination, keyMapping: [{ targetFieldId: createId(() => 'project-ref-tenant'), expression: { kind: 'field', alias: 'root', fieldId: createId(() => 'project-tenant') } }, { targetFieldId: createId(() => 'project-ref-key'), expression: { kind: 'field', alias: 'root', fieldId: createId(() => 'project-key') } }], filterMapping: [{ targetFieldId: createId(() => 'project-child-key'), expression: { kind: 'field', alias: 'root', fieldId: createId(() => 'project-key') } }] } };
 expect(actionChoiceLabel(project, action)).toBe('navigate → Index (/project)');
 expect(actionChoiceLabel(project, scoped)).toBe('navigate → Index (/project) · key tenant reference ← tenant key · key item reference ← key · filter sequence ← key');
 expect(actionChoiceLabel(project, scoped)).not.toContain('project-ref');
 expect(scoped.destination?.keyMapping[0]?.expression).toEqual({ kind: 'field', alias: 'root', fieldId: 'project-tenant' });
});
it('includes success destinations and actionable missing-reference labels', () => {
 expect(actionChoiceLabel(project, { ...action, operation: 'insert', destination: undefined, success: destination })).toBe('insert → Index (/project)');
 expect(actionChoiceLabel(project, { ...action, destination: { ...destination, pageId: createId(), filterMapping: [{ targetFieldId: createId(), expression: { kind: 'field', alias: 'root', fieldId: createId() } }] } })).toBe('navigate → Missing page · filter Missing field ← Missing field');
 expect(actionChoiceLabel(project, { ...action, operation: 'logout', destination: undefined })).toBe('logout');
});
