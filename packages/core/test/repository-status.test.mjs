import assert from 'node:assert/strict';
import test from 'node:test';
import { readRepositoryStatus, RepositoryReadError, summarizeChanges } from '../dist/index.js';

test('summary keeps partial staging in both counts and conflicts separate', () => {
  assert.deepEqual(summarizeChanges([
    { kind: 'tracked', path: 'partial', xy: 'MM', submodule: null },
    { kind: 'tracked', path: 'deleted', xy: 'D.', submodule: null },
    { kind: 'unmerged', path: 'conflict', xy: 'UU', submodule: null },
    { kind: 'untracked', path: 'new', xy: null, submodule: null },
  ]), { staged: 2, unstaged: 1, conflicted: 1, untracked: 1 });
  assert.deepEqual(summarizeChanges([]), { staged: 0, unstaged: 0, conflicted: 0, untracked: 0 });
});

test('use case preserves sources and uses injected observation identity and clock', async () => {
  const state = { repository: { key: 'repo', worktreeKey: 'worktree', rootPath: '/repo', objectFormat: 'sha1' },
    head: { state: 'unborn', branch: 'main', commit: null }, changes: [] };
  const times = ['2026-09-13T00:00:00.000Z', '2026-09-13T00:00:01.000Z'];
  const result = await readRepositoryStatus({ read: async () => state }, { now: () => times.shift(), newId: () => 'observation' });
  assert.deepEqual(result, { ...state, summary: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
    observation: { id: 'observation', startedAt: '2026-09-13T00:00:00.000Z',
      completedAt: '2026-09-13T00:00:01.000Z', consistency: 'best-effort' } });
});

test('reader failure does not turn into an empty successful observation', async () => {
  const failure = new RepositoryReadError('REPOSITORY_CHANGED');
  await assert.rejects(readRepositoryStatus({ read: async () => { throw failure; } }, {
    now: () => '2026-09-13T00:00:00.000Z',
    newId: () => { assert.fail('No success identity on failure'); },
  }), (error) => error === failure);
});
