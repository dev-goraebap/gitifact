import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSessionV3, updateCheckV1, browserHttpErrorV1, updateStateV1, updateV5, projectInitV8 } from '../dist/index.js';

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

test('update command output is versioned, reports the block commit and keeps failures separate', () => {
  const none = { state: 'not-requested', commit: null, paths: [], message: null, reason: null, detail: null };
  const ok = { contract: 'update', version: 5, ok: true, cliVersion: '0.4.0', update: { status: 'available', latestVersion: '0.4.1' },
    install: { npx: 'npx --yes gitifact@0.4.1 update', npmGlobal: 'npm install -g gitifact@0.4.1' }, agentDocs: { state: 'refreshed', paths: ['AGENTS.md'], missing: [] }, commit: none, migrationRequired: false };
  assert.deepEqual(updateV5.parse(ok), ok);
  assert.equal(updateV5.safeParse({ ...ok, install: null, agentDocs: { state: 'not-initialized', paths: [], missing: ['CLAUDE.md'] } }).success, true);
  assert.equal(updateV5.safeParse({ ...ok, agentDocs: { state: 'current', paths: [] } }).success, false);
  assert.equal(updateV5.safeParse({ ...ok, agentDocs: { state: 'unknown', paths: [], missing: [] } }).success, false);
  assert.equal(updateV5.safeParse({ ...ok, extra: true }).success, false);
  const { commit: _omitted, ...withoutCommit } = ok;
  assert.equal(updateV5.safeParse(withoutCommit).success, false);
  assert.equal(updateV5.safeParse({ ...ok, version: 4 }).success, false);
  const { migrationRequired: _flag, ...withoutFlag } = ok;
  assert.equal(updateV5.safeParse(withoutFlag).success, false);
  assert.equal(updateV5.safeParse({ ...ok, migrationRequired: true }).success, true);
  const committed = { state: 'committed', commit: 'a'.repeat(40), paths: ['AGENTS.md'], message: 'chore(gitifact): refresh GITIFACT block to v0.4.0', reason: null, detail: null };
  assert.equal(updateV5.safeParse({ ...ok, commit: committed }).success, true);
  assert.equal(updateV5.safeParse({ ...ok, commit: { ...committed, commit: null } }).success, false);
  assert.equal(updateV5.safeParse({ ...ok, commit: { ...none, state: 'skipped', paths: ['AGENTS.md'], reason: 'other-changes' } }).success, true);
  assert.equal(updateV5.safeParse({ ...ok, commit: { ...none, state: 'skipped' } }).success, false);
  const failure = { contract: 'update', version: 5, ok: false, error: { code: 'UPDATE_FAILED', message: 'x' } };
  assert.deepEqual(updateV5.parse(failure), failure);
});


test('install guidance requires the version-pinned npx command', () => {
  const install = { npx: 'npx --yes gitifact@0.7.1 update', npmGlobal: 'npm install -g gitifact@0.7.1' };
  const update = { contract: 'update', version: 5, ok: true, cliVersion: '0.7.0', update: { status: 'available', latestVersion: '0.7.1' }, install,
    agentDocs: { state: 'current', paths: [], missing: [] }, commit: { state: 'not-requested', commit: null, paths: [], message: null, reason: null, detail: null }, migrationRequired: false };
  const init = { contract: 'project-init', version: 8, ok: true, outcome: 'created', rootPath: '/fixture', configPath: '.gitifact/config.json', schemaVersion: 3,
    baseline: { kind: 'empty' }, agentDocs: { mode: 'install', paths: ['AGENTS.md'] }, lineEndings: { path: '.gitifact/.gitattributes', created: true }, update: update.update, install };
  for (const [schema, value, version] of [[updateV5, update, 4], [projectInitV8, init, 7]]) {
    assert.deepEqual(schema.parse(value), value);
    assert.equal(schema.safeParse({ ...value, install: { npmGlobal: install.npmGlobal } }).success, false);
    assert.equal(schema.safeParse({ ...value, version }).success, false);
    assert.equal(schema.safeParse({ ...value, install: null, update: { status: 'disabled', latestVersion: null } }).success, true);
  }
});


test('read-only update checks have their own contract', () => {
  const check = { contract: 'update-check', version: 1, ok: true, cliVersion: '0.4.0', update, command: 'npx --yes gitifact@0.4.1 update' };
  assert.deepEqual(updateCheckV1.parse(check), check);
  for (const invalid of [{ ...check, command: null }, { ...check, version: 2 }, { ...check, agentDocs: {} },
    { ...check, update: { status: 'checking', latestVersion: null }, command: null },
    { ...check, update: { status: 'disabled', latestVersion: null } }]) assert.equal(updateCheckV1.safeParse(invalid).success, false);
});
