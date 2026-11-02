import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { button, label } from './helpers.js';

type RecordConfig = {
 id: string; pageId: string; keyParameters: string[];
 source: { keys: string[]; fields: { id: string; name: string }[] };
 actions: { id: string; operation: string }[];
};
type Fixture = import('./access-contract.js').AccessFixture;
type Capture = { url: string; headers: Record<string, string>; body: Buffer };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const temporary: Record<string, Record<string, string>> = {
 workshops: { id: '90', name: 'Boundary workshop' },
 sessions: { id: '90', workshop_id: '2', title: 'Boundary session' },
 authors: { id: '90', name: 'Boundary author' },
 books: { id: '90', catalog_code: 'BOUNDARY-90', title: 'Boundary book', publication_date: '' },
 book_authors: { book_id: '3', author_id: '3' },
 copies: { id: '90', barcode: 'BOUNDARY-90', book_id: '3', replacement_cost: '6.25', note: 'Boundary copy' },
 loans: { id: '90', copy_id: '3', checked_out: '2026-02-01', returned_at: '' },
};
function configs(fixture: Fixture) {
 const directory = join(fixture.directory, 'generated/app/server');
 return readdirSync(directory).filter(name => /^record-\d+\.ts$/.test(name)).map(name => ({
  endpoint: '/runtime/' + name.slice(0, -3),
  config: JSON.parse(readFileSync(join(directory, name), 'utf8').split('export const config = ')[1]!.split(' as const;')[0]!) as RecordConfig,
 }));
}
function authConfig(fixture: Fixture) {
 return JSON.parse(readFileSync(join(fixture.directory, 'generated/app/server/auth-config.ts'), 'utf8').split('export const authConfig:Config=')[1]!.replace(/;\s*$/, '')) as {
  cookie: string; loginPath: string; logins: { username: string; password: string; actions: { id: string; operation: string }[] }[];
 };
}
async function csrf(context: BrowserContext, origin: string) {
 const response = await context.request.get(origin + '/runtime/auth/csrf'); expect(response.status()).toBe(200);
 return (await response.json()).csrf as string;
}
async function cookieHeader(context: BrowserContext, origin: string) {
 return (await context.cookies(origin)).map(cookie => cookie.name + '=' + cookie.value).join('; ');
}
async function login(app: Page, fixture: Fixture, target: string) {
 await app.goto(fixture.origin + target); await expect(label(app, 'Username')).toBeVisible();
 await label(app, 'Username').fill(fixture.username); await label(app, 'Password').fill(fixture.secret);
 await button(app, 'login').click(); await expect(app).toHaveURL(fixture.origin + target);
}
async function capture(app: Page, press: string, rows: () => unknown): Promise<Capture> {
 await expect(app.locator('input[name="_csrf"]')).toHaveValue(/^[A-Za-z0-9_-]{43}$/);
 const before = rows(); let captured: Capture | undefined;
 const pattern = new URL(app.url()).pathname;
 await app.route('**' + pattern + '*', async route => {
  const request = route.request(); if (request.method() !== 'POST') return route.continue();
  const headers = await request.allHeaders(); delete headers.host; delete headers['content-length'];
  captured = { url: request.url(), headers, body: request.postDataBuffer()! }; await route.abort();
 });
 try { await button(app, press).click(); await expect.poll(() => !!captured).toBe(true); }
 finally { await app.unroute('**' + pattern + '*'); }
 expect(rows(), 'Intercepted current-build action must not write').toEqual(before); return captured!;
}
async function replay(captured: Capture, cookie: string, origin: string) {
 const response = await fetch(captured.url, { method: 'POST', headers: { ...captured.headers, cookie, origin }, body: new Uint8Array(captured.body).buffer, redirect: 'manual' });
 return { status: response.status, text: await response.text() };
}
async function fill(app: Page, record: Record<string, string>) {
 for (const [name, value] of Object.entries(record)) {
  const control = label(app, name);
  if (await control.evaluate(el => el.tagName === 'SELECT')) await control.selectOption(value); else await control.fill(value);
 }
}

/** Boundary requests observe an already UI-authored fixture; they never create its definitions or repair it. */
export async function accessMatrix(fixture: Fixture, browser: Browser, info: TestInfo, phase: string) {
 const before = fixture.rows(), observations: unknown[] = [], auth = authConfig(fixture);
 const anonymous = await browser.newContext(); const anonNonce = await csrf(anonymous, fixture.origin);
 const observe = (name: string, expected: string) => observations.push({ name, expected, actual: 'assertions passed', rows: digest(fixture.rows()) });
 try {
  for (const page of fixture.project.pages.filter(page => !fixture.project.forms.some(form => form.pageId === page.id && ['Record', 'Login'].includes(form.kind)))) {
   const response = await anonymous.request.get(fixture.origin + page.route, { maxRedirects: 0 }); expect(response.status(), page.route).toBe(200);
   observe('public ' + page.route, 'Anonymous public list/report remains readable');
  }
  for (const { endpoint, config } of configs(fixture)) {
   const table = fixture.project.schema.tables.find(table => fixture.project.forms.some(form => form.id === config.id && form.sourceRef?.id === table.id))!;
   const route = fixture.project.pages.find(page => page.id === config.pageId)!.route;
   const record = temporary[table.physicalName]!; expect(record).toBeDefined();
   const input = Object.fromEntries(config.source.fields.map(field => [field.id, record[field.name] ?? '']));
   const changed = { ...record };
   const mutable = table.columns.find(field => !table.primaryKey.includes(field.id) && field.type.kind === 'text');
   if (mutable) changed[mutable.physicalName] += ' revised'; else if ('checked_out' in changed) changed.checked_out = '2026-02-02'; else changed.author_id = '2';
   const updatedInput = Object.fromEntries(config.source.fields.map(field => [field.id, changed[field.name] ?? '']));
   const updatedKeys = Object.fromEntries(config.source.keys.map((key, index) => [config.keyParameters[index]!, updatedInput[key]!]));
   const keys = Object.fromEntries(config.source.keys.map((key, index) => [config.keyParameters[index]!, input[key]!]));
   const response = await anonymous.request.get(fixture.origin + route + '?' + new URLSearchParams({ [config.id + ':mode']: 'new' }), { maxRedirects: 0 });
   expect(response.status()).toBe(307); expect(response.headers().location).toContain('returnTo=');
   const authorizedNonce = await csrf(fixture.context, fixture.origin);
   for (const operation of ['insert', 'update', 'delete']) {
    const action = config.actions.find(action => action.operation === operation)!; expect(action).toBeDefined();
    const parameters = operation === 'insert' ? { [config.id + ':mode']: 'new' } : operation === 'delete' ? updatedKeys : keys;
    const payload = { action: action.id, parameters, input: operation === 'insert' ? input : updatedInput, confirmed: true };
    const snapshot = fixture.rows();
    for (const [name, origin, nonce] of [['anonymous', fixture.origin, anonNonce], ['invalid-origin', 'https://untrusted.invalid', anonNonce]] as const) {
     const denied = await anonymous.request.post(fixture.origin + endpoint, { headers: { origin, 'x-csrf-token': nonce }, data: payload });
     expect(denied.status()).toBe(name === 'anonymous' ? 401 : 403);
     expect(await denied.json()).toMatchObject({ error: name === 'anonymous' ? 'Sign in is required.' : 'Request origin is not allowed.' });
     expect(fixture.rows()).toEqual(snapshot); observe(table.physicalName + ' JSON ' + operation + ' ' + name, 'Denied with exact zero changed rows');
    }
    const control = await fixture.context.request.post(fixture.origin + endpoint, { headers: { origin: fixture.origin, 'x-csrf-token': authorizedNonce }, data: payload });
    expect(control.status(), table.physicalName + ' valid ' + operation).toBe(200); expect(await control.json()).toMatchObject({ location: expect.any(String) });
    expect(fixture.rows(), 'Authorized identical payload must actually change rows').not.toEqual(snapshot); observe(table.physicalName + ' JSON ' + operation + ' authorized control', 'Valid payload actually changes rows');
   }
   expect(fixture.rows()).toEqual(before);
   // Capture actual React/Next requests, including multipart boundary and action ID, in memory only.
   for (const operation of ['insert', 'update', 'delete']) {
    const parameters = operation === 'insert' ? { [config.id + ':mode']: 'new' } : operation === 'delete' ? updatedKeys : keys;
    await fixture.app.goto(fixture.origin + route + '?' + new URLSearchParams(parameters));
    if (operation === 'insert') await fill(fixture.app, record);
    else if (operation === 'update') await fill(fixture.app, Object.fromEntries(Object.entries(changed).filter(([key, value]) => value !== record[key])));
    else await fixture.app.locator('input[name="_confirmed"]').check();
    const captured = await capture(fixture.app, operation === 'delete' ? 'Delete' : 'Save', fixture.rows);
    expect(captured.headers['next-action'], 'Actual current-build server-action metadata').toBeTruthy();
    const cookies = await cookieHeader(fixture.context, fixture.origin);
    const withoutSession = cookies.split('; ').filter(value => !value.startsWith(auth.cookie + '=')).join('; ');
    const snapshot = fixture.rows(), denied = await replay(captured, withoutSession, fixture.origin);
    expect(fixture.rows()).toEqual(snapshot); expect(denied.text).toContain('Sign in is required.');
    observe(table.physicalName + ' RSC ' + operation + ' anonymous', 'Semantic sign-in denial and exact zero changed rows');
    const badOrigin = await replay(captured, cookies, 'https://untrusted.invalid'); expect(badOrigin.status).toBeGreaterThanOrEqual(400); expect(fixture.rows()).toEqual(snapshot); observe(table.physicalName + ' RSC ' + operation + ' invalid-origin', 'Denied with exact zero changed rows');
    const control = await replay(captured, cookies, fixture.origin); expect(control.status).toBeLessThan(400); expect(fixture.rows()).not.toEqual(snapshot); observe(table.physicalName + ' RSC ' + operation + ' authorized control', 'Current-build valid action actually changes rows');
   }
   expect(fixture.rows()).toEqual(before);
  }
  writeFileSync(info.outputPath(fixture.project.name + '-access-matrix-' + phase + '.json'), JSON.stringify({ mode: 'boundary requests against UI-authored fixture', observations, beforeHash: digest(before), afterHash: digest(fixture.rows()), requestCredentialsAndPayloads: 'retained only in memory' }, null, 2), { mode: 0o600 });
 } finally { await anonymous.close(); }
}

async function sessionChecks(fixture: Fixture, info: TestInfo) {
 const { app, origin, context } = fixture, initial = fixture.rows(), auth = authConfig(fixture);
 const library = fixture.project.name === 'Library Catalog', parent = library ? 'books' : 'workshops', child = library ? 'copies' : 'sessions';
 const parentTitle = library ? 'Uncatalogued Stories' : 'Garden Design', parentKey = library ? '3' : '2';
 const field = library ? 'book_id' : 'workshop_id';
 const route = (tableName: string, kind: string) => {
  const table = fixture.project.schema.tables.find(table => table.physicalName === tableName)!;
  const form = fixture.project.forms.find(form => form.kind === kind && form.sourceRef?.id === table.id)!;
  return fixture.project.pages.find(page => page.id === form.pageId)!.route;
 };
 await app.goto(origin + route(parent, 'Grid')); await app.getByRole('link', { name: parentTitle, exact: true }).click();
 const filtered = app.url(); await expect(app.getByText('No records', { exact: false })).toBeVisible();
 await app.getByRole('link', { name: 'Add ' + child, exact: true }).click(); const target = new URL(app.url()).pathname + new URL(app.url()).search;
 await expect(label(app, field)).toHaveValue(parentKey); await button(app, 'Cancel').click(); await expect(app).toHaveURL(filtered); expect(fixture.rows()).toEqual(initial);
 const priorCookies = await cookieHeader(context, origin);
 await app.getByRole('banner', { name: 'Visitor identity', exact: true }).getByRole('button').click();
 await expect(app.getByRole('banner', { name: 'Visitor identity', exact: true })).not.toContainText(fixture.username);
 await login(app, fixture, target); await expect(label(app, field)).toHaveValue(parentKey);
 await button(app, 'Cancel').click(); await expect(app).toHaveURL(filtered);
 await expect(app.getByRole('banner', { name: 'Visitor identity', exact: true })).toContainText(fixture.username); expect(fixture.rows()).toEqual(initial);
 // Select a real existing row through the filtered list and retain the complete typed key/context.
 await app.goto(origin + route(parent, 'Grid'));
 await app.getByRole('link', { name: library ? 'North Sea' : 'Introduction to Woodworking', exact: true }).click();
 const existingList = app.url(); await app.getByRole('link', { name: 'Edit record', exact: true }).first().click();
 const selected = new URL(app.url()).pathname + new URL(app.url()).search;
 const key = library ? '3' : '1', mutable = library ? 'note' : 'title';
 await expect(label(app, 'id')).toHaveValue(key); const original = await label(app, mutable).inputValue();
 await label(app, mutable).fill('Selected existing row revision'); await button(app, 'Save').click(); await expect(app).toHaveURL(existingList);
 await app.getByRole('link', { name: 'Edit record', exact: true }).first().click(); await expect(label(app, 'id')).toHaveValue(key);
 await label(app, mutable).fill(original); await button(app, 'Save').click(); await expect(app).toHaveURL(existingList); expect(fixture.rows()).toEqual(initial);
 await app.getByRole('link', { name: 'Edit record', exact: true }).first().click(); await label(app, mutable).fill('Canceled selected edit'); await button(app, 'Cancel').click(); await expect(app).toHaveURL(existingList); expect(fixture.rows()).toEqual(initial);
 // An open Record tab must recheck the server session after a second tab logs out.
 await app.goto(origin + selected); await label(app, mutable).fill('Stale tab attempt');
 const staleCookies = await cookieHeader(context, origin), other = await context.newPage();
 try { await other.goto(origin + route(parent, 'Grid')); await other.getByRole('banner', { name: 'Visitor identity', exact: true }).getByRole('button').click(); await expect(other.getByRole('banner', { name: 'Visitor identity', exact: true })).not.toContainText(fixture.username); }
 finally { await other.close(); }
 await button(app, 'Save').click(); await expect(app.getByRole('alert').filter({ hasText: 'Reload this page and sign in again before trying this action.' })).toBeVisible(); expect(fixture.rows()).toEqual(initial);
 await login(app, fixture, selected); await expect(label(app, 'id')).toHaveValue(key); await expect(label(app, mutable)).toHaveValue(original);
 // Revoked tokens remain rejected even when replayed with their original valid nonce.
 const record = configs(fixture).find(({ config }) => config.id === fixture.project.forms.find(form => form.kind === 'Record' && form.sourceRef?.id === fixture.project.schema.tables.find(table => table.physicalName === child)!.id)!.id)!;
 const nonceFrom = (cookies: string) => cookies.split('; ').find(cookie => cookie.startsWith(auth.cookie + '_csrf='))!.split('=')[1]!;
 const payload = { action: record.config.actions.find(action => action.operation === 'insert')!.id, parameters: { [record.config.id + ':mode']: 'new' }, input: Object.fromEntries(record.config.source.fields.map(field => [field.id, temporary[child]![field.name] ?? ''])), confirmed: true };
 for (const cookies of [priorCookies, staleCookies]) {
  const response = await fetch(origin + record.endpoint, { method: 'POST', headers: { cookie: cookies, origin, 'content-type': 'application/json', 'x-csrf-token': nonceFrom(cookies) }, body: JSON.stringify(payload) });
  expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ error: 'Sign in is required.' }); expect(fixture.rows()).toEqual(initial);
 }
 // Explicit isolated fault mode: temporary business rows are created by real
 // authorized handlers; only the current session expiry is deliberately faulted.
 const temp = temporary[child]!, next = { ...temp, id: '91', ...(library ? { barcode: 'BOUNDARY-91' } : {}) };
 const inputFor = (values: Record<string, string>) => Object.fromEntries(record.config.source.fields.map(field => [field.id, values[field.name] ?? '']));
 const parametersFor = (values: Record<string, string>) => Object.fromEntries(record.config.source.keys.map((field, index) => [record.config.keyParameters[index]!, inputFor(values)[field]!]));
 const changed = { ...temp, [mutable]: 'Expiry write control' };
 const requestFor = (operation: string, values: Record<string, string>) => ({ action: record.config.actions.find(action => action.operation === operation)!.id, parameters: operation === 'insert' ? { [record.config.id + ':mode']: 'new' } : parametersFor(temp), input: inputFor(values), confirmed: true });
 const controls = [['insert', temp], ['update', changed], ['delete', changed], ['insert', temp], ['insert', next], ['delete', next]] as const;
 const freshNonce = await csrf(context, origin);
 for (const [operation, values] of controls) {
  const body = requestFor(operation, values); if (values === next && operation === 'delete') body.parameters = parametersFor(next);
  const snapshot = fixture.rows(), response = await context.request.post(origin + record.endpoint, { headers: { origin, 'x-csrf-token': freshNonce }, data: body });
  expect(response.status()).toBe(200); expect(fixture.rows()).not.toEqual(snapshot);
 }
 const faultRows = fixture.rows(), captures: Capture[] = [];
 for (const operation of ['insert', 'update', 'delete']) {
  const parameters = operation === 'insert' ? { [record.config.id + ':mode']: 'new' } : parametersFor(temp);
  await app.goto(origin + route(child, 'Record') + '?' + new URLSearchParams(parameters));
  if (operation === 'insert') await fill(app, next); else if (operation === 'update') await label(app, mutable).fill(changed[mutable]!); else await app.locator('input[name="_confirmed"]').check();
  captures.push(await capture(app, operation === 'delete' ? 'Delete' : 'Save', fixture.rows));
 }
 const retainedCookies = await cookieHeader(context, origin), currentToken = (await context.cookies(origin)).find(cookie => cookie.name === auth.cookie)!.value;
 const identityPath = fixture.database + '.auth-' + createHash('sha256').update(fixture.project.id).digest('hex').slice(0, 32) + '.sqlite';
 const store = new Database(identityPath, { fileMustExist: true });
 try { expect(store.prepare('UPDATE sessions SET expires=? WHERE project=? AND token=?').run(Date.now() - 1, fixture.project.id, createHash('sha256').update(currentToken).digest('hex')).changes).toBe(1); } finally { store.close(); }
 for (const captured of captures) {
  const expired = await replay(captured, retainedCookies, origin); expect(fixture.rows()).toEqual(faultRows); expect(expired.text).toContain('Sign in is required.');
 }
 for (const [operation, values] of [['insert', next], ['update', changed], ['delete', changed]] as const) {
  const expired = await fetch(origin + record.endpoint, { method: 'POST', headers: { cookie: retainedCookies, origin, 'content-type': 'application/json', 'x-csrf-token': nonceFrom(retainedCookies) }, body: JSON.stringify(requestFor(operation, values)) });
  expect(expired.status).toBe(401); expect(await expired.json()).toMatchObject({ error: 'Sign in is required.' }); expect(fixture.rows()).toEqual(faultRows);
 }
 await login(app, fixture, selected); await expect(label(app, 'id')).toHaveValue(key); await expect(label(app, mutable)).toHaveValue(original);
 const cleanup = await context.request.post(origin + record.endpoint, { headers: { origin, 'x-csrf-token': await csrf(context, origin) }, data: requestFor('delete', temp) });
 expect(cleanup.status()).toBe(200); expect(fixture.rows()).toEqual(initial);
 writeFileSync(info.outputPath(fixture.project.name + '-expiry-fault.json'), JSON.stringify({ mode: 'fault', fixturePhase: 'owned visitor-session expiry', setup: 'real authorized JSON handler controls with temporary business rows', injection: 'expires changed only for current project/token hash', JSON: ['insert', 'update', 'delete'], capturedRSC: ['insert', 'update', 'delete'], denial: 'Sign in is required.', unchangedFaultRowsHash: digest(faultRows), beforeBusinessRowsHash: digest(initial), afterAuthorizedCleanupHash: digest(fixture.rows()) }, null, 2));
 await button(app, 'Cancel').click(); await expect(app).toHaveURL(existingList);
 // Malformed return targets fail before credential processing, without navigating externally.
 const nonce = await csrf(context, origin), loginConfig = auth.logins[0]!;
 const invalid = ['https://untrusted.invalid/', '//untrusted.invalid/', '/\\untrusted.invalid/', '/unknown-route', selected + '&undeclared=1', selected + '&' + encodeURIComponent(record.config.keyParameters[0]!) + '=bad', route(child, 'Record') + '?' + new URLSearchParams({ [record.config.keyParameters[0]!]: 'not-an-integer' })];
 for (const returnTo of invalid) {
  const response = await context.request.post(origin + '/runtime/auth', { headers: { origin }, multipart: { _csrf: nonce, _action: loginConfig.actions.find(action => action.operation === 'login')!.id, returnTo, [loginConfig.username]: fixture.username, [loginConfig.password]: fixture.secret } });
  expect(response.status(), returnTo).toBe(400); expect(await response.json()).toMatchObject({ error: 'Invalid return target.' }); expect(fixture.rows()).toEqual(initial);
 }
 const malformed = new URLSearchParams({ [record.config.keyParameters[0]!]: 'not-an-integer' });
 const badKey = await context.request.get(origin + record.endpoint + '?' + malformed); expect(badKey.status()).toBe(400); expect(fixture.rows()).toEqual(initial);
 const selectedParameters = Object.fromEntries(new URL(origin + selected).searchParams);
 const invalidParameters = [{ ...selectedParameters, [record.config.keyParameters[0]!]: 'not-an-integer' }, { ...selectedParameters, undeclared: '1' }];
 const selectedFilter = Object.keys(selectedParameters).find(key => key.includes(':filter:'));
 if (selectedFilter) invalidParameters.push({ ...selectedParameters, [selectedFilter]: 'not-an-integer' });
 for (const parameters of invalidParameters) {
  const rejected = await context.request.post(origin + record.endpoint, { headers: { origin, 'x-csrf-token': nonce }, data: { ...payload, action: record.config.actions.find(action => action.operation === 'update')!.id, parameters } });
  expect(rejected.status()).toBe(400); expect(fixture.rows()).toEqual(initial);
 }

 writeFileSync(info.outputPath(fixture.project.name + '-sessions.json'), JSON.stringify({ mode: 'ui_journey; expiry evidence is separately labeled fault', selectedParent: parentKey, selectedRecord: key, checks: ['empty filtered list', 'Add/login/Cancel typed context', 'existing selected Save/Cancel', 'cross-tab logout', 'revoked-token direct write', 'expired-token RSC and JSON write', 'relogin preserves selected key', 'external and malformed return rejection', 'malformed typed key'], beforeHash: digest(initial), afterHash: digest(fixture.rows()) }, null, 2), { mode: 0o600 });
}

async function crossApplication(first: Fixture, second: Fixture, browser: Browser, info: TestInfo) {
 const context = await browser.newContext(), a = await context.newPage(), b = await context.newPage();
 const beforeA = first.rows(), beforeB = second.rows();
 const newRecord = (fixture: Fixture) => {
  const { config } = configs(fixture)[0]!;
  return fixture.project.pages.find(page => page.id === config.pageId)!.route + '?' + new URLSearchParams({ [config.id + ':mode']: 'new' });
 };
 try {
  await login(a, first, newRecord(first)); await button(a, 'Cancel').click(); const authA = authConfig(first), authB = authConfig(second);
  const tokenA = (await context.cookies(first.origin)).find(cookie => cookie.name === authA.cookie)!.value;
  await b.goto(second.origin + newRecord(second)); await expect(label(b, 'Username')).toBeVisible();
  await label(b, 'Username').fill(second.username); await label(b, 'Password').fill(second.secret); await button(b, 'login').click(); await expect(b).toHaveURL(second.origin + newRecord(second)); await button(b, 'Cancel').click();
  await a.reload(); await expect(a.getByRole('banner', { name: 'Visitor identity', exact: true })).toContainText(first.username);
  await expect(b.getByRole('banner', { name: 'Visitor identity', exact: true })).toContainText(second.username);
  const nonce = await csrf(context, second.origin), { config, endpoint } = configs(second)[0]!;
  const table = second.project.schema.tables.find(table => second.project.forms.some(form => form.id === config.id && form.sourceRef?.id === table.id))!;
  const cookies = (await cookieHeader(context, second.origin)).split('; ').filter(cookie => !cookie.startsWith(authB.cookie + '=')).concat(authB.cookie + '=' + tokenA).join('; ');
  const forged = await fetch(second.origin + endpoint, { method: 'POST', headers: { cookie: cookies, origin: second.origin, 'content-type': 'application/json', 'x-csrf-token': nonce }, body: JSON.stringify({ action: config.actions.find(action => action.operation === 'insert')!.id, parameters: { [config.id + ':mode']: 'new' }, input: Object.fromEntries(config.source.fields.map(field => [field.id, temporary[table.physicalName]![field.name] ?? ''])), confirmed: true }) });
  expect(forged.status).toBe(401); expect(await forged.json()).toMatchObject({ error: 'Sign in is required.' }); expect(first.rows()).toEqual(beforeA); expect(second.rows()).toEqual(beforeB);
  await a.getByRole('banner', { name: 'Visitor identity', exact: true }).getByRole('button').click();
  await expect(a.getByRole('banner', { name: 'Visitor identity', exact: true })).not.toContainText(first.username);
  await b.reload(); await expect(b.getByRole('banner', { name: 'Visitor identity', exact: true })).toContainText(second.username);
  expect(first.rows()).toEqual(beforeA); expect(second.rows()).toEqual(beforeB);
  writeFileSync(info.outputPath('cross-project-sessions.json'), JSON.stringify({ mode: 'same-browser two UI-authored apps', checks: ['login A does not authenticate B', 'login B preserves A', 'A token under B cookie name denied with valid B CSRF', 'logout A preserves B'], beforeHashes: [digest(beforeA), digest(beforeB)], afterHashes: [digest(first.rows()), digest(second.rows())] }, null, 2));
 } finally { await context.close(); }
}

import { startIsolatedStudio } from './helpers.js';
import { workshopJourney } from './workshop-journey.js';
import { libraryJourney } from './library-journey.js';
test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(900000);
test('both UI-authored applications enforce public reads, real write handlers and session boundaries', async ({ browser }, info) => {
 const studios: Awaited<ReturnType<typeof startIsolatedStudio>>[] = [], contexts: BrowserContext[] = [];
 const releases: (() => void)[] = [], runs: Promise<void>[] = [];
 const fixtures: Fixture[] = [];
 let primaryFailure: unknown;
 const scoped = (prefix: string) => new Proxy(info, { get: (target, key) => key === 'outputPath' ? (...parts: string[]) => info.outputPath(prefix + '-' + parts.join('-')) : Reflect.get(target, key) });
 try {
  for (const [name, journey] of [['workshop', workshopJourney], ['library', libraryJourney]] as const) {
   const studio = await startIsolatedStudio('schema-baron-access-' + name + '-'); studios.push(studio);
   const author = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(author);
   const page = await author.newPage(), ready = deferred<Fixture>(), hold = deferred<void>(); releases.push(() => hold.resolve());
   const run = journey(page, browser, scoped(name), studio, { onVisitor: context => { contexts.push(context); }, populated: async fixture => { ready.resolve(fixture); await hold.promise; } });
   runs.push(run); fixtures.push(await Promise.race([ready.promise, run.then(() => { throw Error('Journey ended without populated access callback'); })]));
  }
  for (const fixture of fixtures) { await accessMatrix(fixture, browser, info, 'initial'); await sessionChecks(fixture, info); }
  await crossApplication(fixtures[0]!, fixtures[1]!, browser, info);
  // Repeat all direct/public checks after valid edits, rejected edits and session changes.
  for (const fixture of fixtures) await accessMatrix(fixture, browser, info, 'after-state-changes');
 } catch (error) { primaryFailure = error; throw error; } finally {
  for (const release of releases) release();
  const results = await Promise.allSettled(runs);
  for (const context of contexts.reverse()) await context.close();
  for (const studio of studios.reverse()) await studio.stop();
  const failed = results.find(result => result.status === 'rejected'); if (!primaryFailure && failed?.status === 'rejected') throw failed.reason;
 }
});
