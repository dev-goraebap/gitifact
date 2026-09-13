import assert from 'node:assert/strict';
import test from 'node:test';
import { repositoryStatusV1, repositoryStatusSuccessV1 } from '../dist/index.js';

const success = () => ({
  contract: 'repository-status', version: 1, ok: true,
  observation: { id: '7cc37dc4-4ea7-4252-b9de-24944fbfb5a2', startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: '2026-09-13T00:00:01.000Z', consistency: 'best-effort' },
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64), rootPath: 'C:/repo', objectFormat: 'sha1' },
  head: { state: 'branch', branch: 'main', commit: 'c'.repeat(40) },
  changes: [{ kind: 'tracked', path: '한글 file.txt', xy: 'MM', submodule: null }],
  summary: { staged: 1, unstaged: 1, untracked: 0, conflicted: 0 },
  checks: { state: 'not-run', reason: 'git-status-only' },
});
test('JSON round trip validates both result variants', () => {
  const value = success();
  assert.deepEqual(repositoryStatusV1.parse(JSON.parse(JSON.stringify(value))), value);
  const failure = { contract: 'repository-status', version: 1, ok: false,
    error: { code: 'GIT_FAILED', message: 'Git 조회 실패' } };
  assert.deepEqual(repositoryStatusV1.parse(failure), failure);
});
test('unknown contracts, false clean claims, malformed IDs, paths and inconsistent summaries fail', () => {
  const mutations = [
    (v) => { v.version = 2; }, (v) => { v.checks.state = 'clean'; },
    (v) => { v.head.commit = null; }, (v) => { v.head.commit = '0'.repeat(40); },
    (v) => { v.repository.objectFormat = 'sha256'; },
    (v) => { v.summary.staged = 0; }, (v) => { v.summary.untracked = -1; },
    (v) => { v.changes.push(v.changes[0]); }, (v) => { v.changes[0].path = '../escape'; },
    (v) => { v.changes[0].path = '\ud800'; }, (v) => { v.changes[0].xy = '??'; },
    (v) => { v.observation.consistency = 'atomic'; },
  ];
  for (const mutate of mutations) {
    const value = success(); mutate(value);
    assert.equal(repositoryStatusSuccessV1.safeParse(value).success, false);
  }
});
test('unborn and detached identities are distinct', () => {
  const value = success();
  value.head = { state: 'unborn', branch: 'main', commit: null };
  assert.ok(repositoryStatusSuccessV1.safeParse(value).success);
  value.head = { state: 'detached', branch: null, commit: 'e'.repeat(40) };
  assert.ok(repositoryStatusSuccessV1.safeParse(value).success);
});
