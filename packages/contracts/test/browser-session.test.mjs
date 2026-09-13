import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSessionV1, browserHttpErrorV1 } from '../dist/index.js';

test('session identity rejects unknown versions, malformed identities and extra fields', () => {
  const value = { contract: 'browser-session', version: 1,
    sessionId: '7cc37dc4-4ea7-4252-b9de-24944fbfb5a2',
    repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) } };
  assert.deepEqual(browserSessionV1.parse(JSON.parse(JSON.stringify(value))), value);
  for (const invalid of [{ ...value, version: 2 }, { ...value, sessionId: 'wrong' },
    { ...value, repository: { ...value.repository, worktreeKey: 'repo:' + 'b'.repeat(64) } },
    { ...value, path: '/arbitrary' }]) assert.equal(browserSessionV1.safeParse(invalid).success, false);
  const error = { contract: 'browser-http-error', version: 1, error: { code: 'SESSION_CHANGED', message: 'Reconnect' } };
  assert.deepEqual(browserHttpErrorV1.parse(error), error);
  assert.equal(browserHttpErrorV1.safeParse({ ...error, error: { code: 'UNKNOWN', message: 'error' } }).success, false);
});
