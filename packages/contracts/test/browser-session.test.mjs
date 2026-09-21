import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSessionV3, updateCheckV1, browserSessionV2, browserHttpErrorV1, updateStateV1, updateV3, updateV4, projectInitV5, projectInitV6 } from '../dist/index.js';

const value = { contract: 'browser-session', version: 2,
  sessionId: '7cc37dc4-4ea7-4252-b9de-24944fbfb5a2',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
  cliVersion: '0.4.0', update: { status: 'available', latestVersion: '0.4.1' } };

test('session identity rejects unknown versions, malformed identities and extra fields', () => {
  assert.deepEqual(browserSessionV2.parse(JSON.parse(JSON.stringify(value))), value);
  assert.equal(browserSessionV2.safeParse({ ...value, cliVersion: '0.4.0-dev.1' }).success, true);
  for (const invalid of [{ ...value, version: 1 }, { ...value, version: 3 }, { ...value, sessionId: 'wrong' },
    { ...value, repository: { ...value.repository, worktreeKey: 'repo:' + 'b'.repeat(64) } },
    { ...value, path: '/arbitrary' }, { ...value, cliVersion: 'latest' }, { ...value, cliVersion: undefined }]) assert.equal(browserSessionV2.safeParse(invalid).success, false);
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
  const ok = { contract: 'update', version: 3, ok: true, cliVersion: '0.4.0', update: { status: 'available', latestVersion: '0.4.1' },
    install: { npmGlobal: 'npm install -g gitifact@0.4.1' }, agentDocs: { state: 'refreshed', paths: ['AGENTS.md'], missing: [] }, commit: none };
  assert.deepEqual(updateV3.parse(ok), ok);
  assert.equal(updateV3.safeParse({ ...ok, install: null, agentDocs: { state: 'not-initialized', paths: [], missing: ['CLAUDE.md'] } }).success, true);
  assert.equal(updateV3.safeParse({ ...ok, agentDocs: { state: 'current', paths: [] } }).success, false);
  assert.equal(updateV3.safeParse({ ...ok, agentDocs: { state: 'unknown', paths: [], missing: [] } }).success, false);
  assert.equal(updateV3.safeParse({ ...ok, extra: true }).success, false);
  const { commit: _omitted, ...withoutCommit } = ok;
  assert.equal(updateV3.safeParse(withoutCommit).success, false);
  assert.equal(updateV3.safeParse({ ...ok, version: 2 }).success, false);
  const committed = { state: 'committed', commit: 'a'.repeat(40), paths: ['AGENTS.md'], message: 'chore(gitifact): refresh GITIFACT block to v0.4.0', reason: null, detail: null };
  assert.equal(updateV3.safeParse({ ...ok, commit: committed }).success, true);
  assert.equal(updateV3.safeParse({ ...ok, commit: { ...committed, commit: null } }).success, false);
  assert.equal(updateV3.safeParse({ ...ok, commit: { ...none, state: 'skipped', paths: ['AGENTS.md'], reason: 'other-changes' } }).success, true);
  assert.equal(updateV3.safeParse({ ...ok, commit: { ...none, state: 'skipped' } }).success, false);
  const failure = { contract: 'update', version: 3, ok: false, error: { code: 'UPDATE_FAILED', message: 'x' } };
  assert.deepEqual(updateV3.parse(failure), failure);
});


test('npx guidance uses new contract versions without changing the previous shapes', () => {
  const install = { npx: 'npx --yes gitifact@0.7.1 update', npmGlobal: 'npm install -g gitifact@0.7.1' };
  const update = { contract: 'update', version: 4, ok: true, cliVersion: '0.7.0', update: { status: 'available', latestVersion: '0.7.1' }, install,
    agentDocs: { state: 'current', paths: [], missing: [] }, commit: { state: 'not-requested', commit: null, paths: [], message: null, reason: null, detail: null } };
  const init = { contract: 'project-init', version: 6, ok: true, outcome: 'created', rootPath: '/fixture', configPath: '.gitifact/config.json', schemaVersion: 2,
    baseline: { kind: 'empty' }, agentDocs: { mode: 'install', paths: ['AGENTS.md'] }, update: update.update, install };
  for (const [schema, old, value, version] of [[updateV4, updateV3, update, 3], [projectInitV6, projectInitV5, init, 5]]) {
    assert.deepEqual(schema.parse(value), value);
    assert.equal(schema.safeParse({ ...value, install: { npmGlobal: install.npmGlobal } }).success, false);
    assert.equal(schema.safeParse({ ...value, version }).success, false);
    assert.equal(old.safeParse({ ...value, version }).success, false);
    assert.equal(old.safeParse({ ...value, version, install: { npmGlobal: install.npmGlobal } }).success, true);
    assert.equal(schema.safeParse({ ...value, install: null, update: { status: 'disabled', latestVersion: null } }).success, true);
  }
});


test('session v3 removes update state and read-only checks have their own contract', () => {
  const { update, ...identity } = value;
  const current = { ...identity, version: 3 };
  assert.deepEqual(browserSessionV3.parse(current), current);
  assert.equal(browserSessionV3.safeParse(value).success, false);
  assert.equal(browserSessionV3.safeParse({ ...current, update }).success, false);
  assert.equal(browserSessionV2.safeParse(current).success, false);
  const check = { contract: 'update-check', version: 1, ok: true, cliVersion: '0.4.0', update, command: 'npx --yes gitifact@0.4.1 update' };
  assert.deepEqual(updateCheckV1.parse(check), check);
  for (const invalid of [{ ...check, command: null }, { ...check, version: 2 }, { ...check, agentDocs: {} },
    { ...check, update: { status: 'checking', latestVersion: null }, command: null },
    { ...check, update: { status: 'disabled', latestVersion: null } }]) assert.equal(updateCheckV1.safeParse(invalid).success, false);
});
