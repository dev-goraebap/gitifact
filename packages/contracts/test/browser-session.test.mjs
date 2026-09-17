import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSessionV2, browserHttpErrorV1, updateStateV1, updateV2 } from '../dist/index.js';

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
  const ok = { contract: 'update', version: 2, ok: true, cliVersion: '0.4.0', update: { status: 'available', latestVersion: '0.4.1' },
    install: { npmGlobal: 'npm install -g gitifact@0.4.1' }, agentDocs: { state: 'refreshed', paths: ['AGENTS.md'] }, commit: none };
  assert.deepEqual(updateV2.parse(ok), ok);
  assert.equal(updateV2.safeParse({ ...ok, install: null, agentDocs: { state: 'not-initialized', paths: [] } }).success, true);
  assert.equal(updateV2.safeParse({ ...ok, agentDocs: { state: 'unknown', paths: [] } }).success, false);
  assert.equal(updateV2.safeParse({ ...ok, extra: true }).success, false);
  const { commit: _omitted, ...withoutCommit } = ok;
  assert.equal(updateV2.safeParse(withoutCommit).success, false);
  assert.equal(updateV2.safeParse({ ...ok, version: 1 }).success, false);
  const committed = { state: 'committed', commit: 'a'.repeat(40), paths: ['AGENTS.md'], message: 'chore(gitifact): refresh GITIFACT block to v0.4.0', reason: null, detail: null };
  assert.equal(updateV2.safeParse({ ...ok, commit: committed }).success, true);
  assert.equal(updateV2.safeParse({ ...ok, commit: { ...committed, commit: null } }).success, false);
  assert.equal(updateV2.safeParse({ ...ok, commit: { ...none, state: 'skipped', paths: ['AGENTS.md'], reason: 'other-changes' } }).success, true);
  assert.equal(updateV2.safeParse({ ...ok, commit: { ...none, state: 'skipped' } }).success, false);
  const failure = { contract: 'update', version: 2, ok: false, error: { code: 'UPDATE_FAILED', message: 'x' } };
  assert.deepEqual(updateV2.parse(failure), failure);
});
