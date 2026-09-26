import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSessionV3, updateCheckV1, browserHttpErrorV1, updateStateV1, updateV6, updateLaterV1, projectInitV8 } from '../dist/index.js';

const value = { contract: 'browser-session', version: 3,
  sessionId: '7cc37dc4-4ea7-4252-b9de-24944fbfb5a2',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
  cliVersion: '0.4.0' };
const update = { status: 'available', latestVersion: '0.4.1' };

test('session identity rejects unknown versions, malformed identities and extra fields', () => {
  assert.deepEqual(browserSessionV3.parse(JSON.parse(JSON.stringify(value))), value);
  assert.equal(browserSessionV3.safeParse({ ...value, cliVersion: '0.4.0-dev.1' }).success, true);
  for (const invalid of [{ ...value, version: 2 }, { ...value, version: 4 }, { ...value, update }, { ...value, sessionId: 'wrong' },
    { ...value, repository: { ...value.repository, worktreeKey: 'repo:' + 'b'.repeat(64) } },
    { ...value, path: '/arbitrary' }, { ...value, cliVersion: 'latest' }, { ...value, cliVersion: undefined }]) assert.equal(browserSessionV3.safeParse(invalid).success, false);
  const error = { contract: 'browser-http-error', version: 1, error: { code: 'SESSION_CHANGED', message: 'Reconnect' } };
  assert.deepEqual(browserHttpErrorV1.parse(error), error);
  assert.equal(browserHttpErrorV1.safeParse({ ...error, error: { code: 'UNKNOWN', message: 'error' } }).success, false);
});

test('update state carries a version exactly when the check produced a result', () => {
  for (const state of [{ status: 'checking', latestVersion: null }, { status: 'available', latestVersion: '1.2.3' },
    { status: 'up-to-date', latestVersion: '0.4.0' }, { status: 'unavailable', latestVersion: null }, { status: 'disabled', latestVersion: null }]) assert.deepEqual(updateStateV1.parse(state), state);
  for (const state of [{ status: 'available', latestVersion: null }, { status: 'up-to-date', latestVersion: null },
    { status: 'unavailable', latestVersion: '1.2.3' }, { status: 'checking', latestVersion: '1.2.3' }, { status: 'disabled', latestVersion: '1.2.3' },
    { status: 'available', latestVersion: '1.2.3-beta.1' }, { status: 'available', latestVersion: 'latest' }, { status: 'newer', latestVersion: null },
    { status: 'available' }]) assert.equal(updateStateV1.safeParse(state).success, false);
});

test('update command output is versioned, reports the project release and the commit, and keeps failures separate', () => {
  const none = { state: 'not-requested', commit: null, paths: [], message: null, reason: null, detail: null };
  const ok = { contract: 'update', version: 6, ok: true, cliVersion: '0.4.0', update: { status: 'available', latestVersion: '0.4.1' },
    install: { npmGlobal: 'npm install -g gitifact@0.4.1' }, agentDocs: { state: 'refreshed', paths: ['AGENTS.md'], missing: [] },
    project: { state: 'written', cli: '0.4.0' }, commit: none, migrationRequired: false };
  assert.deepEqual(updateV6.parse(ok), ok);
  assert.equal(updateV6.safeParse({ ...ok, install: null, agentDocs: { state: 'not-initialized', paths: [], missing: ['CLAUDE.md'] }, project: { state: 'not-initialized', cli: null } }).success, true);
  assert.equal(updateV6.safeParse({ ...ok, agentDocs: { state: 'current', paths: [] } }).success, false);
  assert.equal(updateV6.safeParse({ ...ok, agentDocs: { state: 'unknown', paths: [], missing: [] } }).success, false);
  assert.equal(updateV6.safeParse({ ...ok, project: { state: 'raised', cli: '0.4.0' } }).success, false);
  assert.equal(updateV6.safeParse({ ...ok, extra: true }).success, false);
  // The global install is the only install command; the npx form of v5 is gone.
  assert.equal(updateV6.safeParse({ ...ok, install: { npx: 'npx --yes gitifact@0.4.1 update', npmGlobal: 'npm install -g gitifact@0.4.1' } }).success, false);
  for (const field of ['commit', 'project', 'migrationRequired']) {
    const { [field]: _omitted, ...without } = ok;
    assert.equal(updateV6.safeParse(without).success, false);
  }
  assert.equal(updateV6.safeParse({ ...ok, version: 5 }).success, false);
  assert.equal(updateV6.safeParse({ ...ok, migrationRequired: true }).success, true);
  const committed = { state: 'committed', commit: 'a'.repeat(40), paths: ['.gitifact/config.json', 'AGENTS.md'], message: 'chore(gitifact): update project to gitifact v0.4.0', reason: null, detail: null };
  assert.equal(updateV6.safeParse({ ...ok, commit: committed }).success, true);
  assert.equal(updateV6.safeParse({ ...ok, commit: { ...committed, commit: null } }).success, false);
  assert.equal(updateV6.safeParse({ ...ok, commit: { ...none, state: 'skipped', paths: ['AGENTS.md'], reason: 'other-changes' } }).success, true);
  assert.equal(updateV6.safeParse({ ...ok, commit: { ...none, state: 'skipped' } }).success, false);
  const failure = { contract: 'update', version: 6, ok: false, error: { code: 'UPDATE_FAILED', message: 'x' } };
  assert.deepEqual(updateV6.parse(failure), failure);
});

test('init install guidance still carries the version-pinned npx command', () => {
  const install = { npx: 'npx --yes gitifact@0.7.1 update', npmGlobal: 'npm install -g gitifact@0.7.1' };
  const init = { contract: 'project-init', version: 8, ok: true, outcome: 'created', rootPath: '/fixture', configPath: '.gitifact/config.json', schemaVersion: 3,
    baseline: { kind: 'empty' }, agentDocs: { mode: 'install', paths: ['AGENTS.md'] }, lineEndings: { path: '.gitifact/.gitattributes', created: true },
    update: { status: 'available', latestVersion: '0.7.1' }, install };
  assert.deepEqual(projectInitV8.parse(init), init);
  assert.equal(projectInitV8.safeParse({ ...init, install: { npmGlobal: install.npmGlobal } }).success, false);
  assert.equal(projectInitV8.safeParse({ ...init, version: 7 }).success, false);
  assert.equal(projectInitV8.safeParse({ ...init, install: null, update: { status: 'disabled', latestVersion: null } }).success, true);
});

test('postponing a release notice has its own contract', () => {
  const later = { contract: 'update-later', version: 1, ok: true, cliVersion: '0.8.3', later: { version: '0.8.4', until: '2026-09-27T10:00:00.000Z' } };
  assert.deepEqual(updateLaterV1.parse(later), later);
  assert.equal(updateLaterV1.safeParse({ ...later, later: null }).success, true);
  for (const invalid of [{ ...later, later: { version: '0.8.4', until: 'tomorrow' } }, { ...later, version: 2 }, { ...later, extra: true }]) {
    assert.equal(updateLaterV1.safeParse(invalid).success, false);
  }
});


test('read-only update checks have their own contract', () => {
  const check = { contract: 'update-check', version: 1, ok: true, cliVersion: '0.4.0', update, command: 'npx --yes gitifact@0.4.1 update' };
  assert.deepEqual(updateCheckV1.parse(check), check);
  for (const invalid of [{ ...check, command: null }, { ...check, version: 2 }, { ...check, agentDocs: {} },
    { ...check, update: { status: 'checking', latestVersion: null }, command: null },
    { ...check, update: { status: 'disabled', latestVersion: null } }]) assert.equal(updateCheckV1.safeParse(invalid).success, false);
});
