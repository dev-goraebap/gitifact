import assert from 'node:assert/strict';
import { mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, fingerprint } from './git-fixture.mjs';

test('unborn repository, clean checkout, subdirectory and detached HEAD', (t) => {
  const f = fixture(t);
  const initial = f.status();
  assert.deepEqual(initial.head, { state: 'unborn', branch: 'main', commit: null });
  assert.deepEqual(initial.changes, []);
  assert.deepEqual(initial.checks, { state: 'not-run', reason: 'git-status-only' });
  f.write('file', 'A\n'); f.commit();
  const clean = f.status();
  assert.equal(clean.head.state, 'branch');
  assert.equal(clean.head.commit, f.git(['rev-parse', 'HEAD']).stdout.trim());
  assert.deepEqual(clean.summary, { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 });
  mkdirSync(join(f.repo, 'subdir'));
  assert.deepEqual(f.status(join(f.repo, 'subdir')).repository, clean.repository);
  f.git(['checkout', '--detach']);
  assert.deepEqual(f.status().head, { state: 'detached', branch: null, commit: clean.head.commit });
});

test('partial staging and Unicode paths preserve all files, index, refs and config', (t) => {
  const f = fixture(t);
  f.write('tracked.txt', 'A\n'); f.commit();
  f.write('tracked.txt', 'B\n'); f.git(['add', 'tracked.txt']);
  f.write('tracked.txt', 'C\n'); f.write('한글 space.txt', 'new\n');
  f.write('.gitignore', 'ignored\n'); f.write('ignored', 'hidden');
  const before = fingerprint(f.repo);
  const result = f.status();
  assert.deepEqual(result.changes.find((v) => v.path === 'tracked.txt'), { kind: 'tracked', path: 'tracked.txt', xy: 'MM', submodule: null });
  assert.deepEqual(result.summary, { staged: 1, unstaged: 1, untracked: 2, conflicted: 0 });
  assert.ok(!result.changes.some((v) => v.path === 'ignored'));
  assert.equal(result.observation.consistency, 'best-effort');
  assert.notEqual(result.observation.id, f.status().observation.id);
  assert.deepEqual(fingerprint(f.repo), before);
  const text = f.cli(['--format', 'text']);
  assert.equal(text.status, 0); assert.equal(text.stderr, '');
  assert.match(text.stdout, /gitifact 검사 미실행/);
  assert.match(text.stdout, /MM "tracked.txt"/);
  assert.deepEqual(fingerprint(f.repo), before);
});

test('deletion, rename without inference and intent-to-add', (t) => {
  const f = fixture(t);
  f.write('old', 'A\n'); f.write('deleted', 'B\n'); f.commit();
  f.git(['config', 'status.renames', 'true']);
  renameSync(join(f.repo, 'old'), join(f.repo, 'new'));
  f.git(['add', '-A']);
  unlinkSync(join(f.repo, 'deleted'));
  f.write('intent', 'new\n'); f.git(['add', '-N', 'intent']);
  assert.deepEqual(f.status().changes.map(({ path, xy }) => [path, xy]), [
    ['deleted', '.D'], ['intent', '.A'], ['new', 'A.'], ['old', 'D.'],
  ]);
});

test('merge conflict is a successful observation with a conflict count', (t) => {
  const f = fixture(t);
  f.write('file', 'base\n'); f.commit();
  f.git(['checkout', '-b', 'side']); f.write('file', 'side\n'); f.commit();
  f.git(['checkout', 'main']); f.write('file', 'main\n'); f.commit();
  assert.notEqual(f.git(['merge', 'side'], f.repo, true).status, 0);
  const before = fingerprint(f.repo);
  const result = f.status();
  assert.deepEqual(result.changes, [{ kind: 'unmerged', path: 'file', xy: 'UU', submodule: null }]);
  assert.deepEqual(result.summary, { staged: 0, unstaged: 0, untracked: 0, conflicted: 1 });
  assert.deepEqual(fingerprint(f.repo), before);
});

test('linked worktrees share repository identity while keeping branch and changes separate', (t) => {
  const f = fixture(t);
  f.write('file', 'base\n'); f.commit();
  const linked = join(f.root, 'linked');
  f.git(['worktree', 'add', '-b', 'linked', linked]);
  f.write('file', 'main change\n');
  f.write('only-linked', 'new\n', linked);
  const before = fingerprint(f.root);
  const a = f.status(); const b = f.status(linked);
  assert.equal(a.repository.key, b.repository.key);
  assert.notEqual(a.repository.worktreeKey, b.repository.worktreeKey);
  assert.equal(a.head.branch, 'main'); assert.equal(b.head.branch, 'linked');
  assert.deepEqual(a.changes.map((v) => v.path), ['file']);
  assert.deepEqual(b.changes.map((v) => v.path), ['only-linked']);
  assert.deepEqual(fingerprint(f.root), before);
});

test('submodule changes retain flags without listing nested files', (t) => {
  const f = fixture(t);
  f.write('base', 'parent\n'); f.commit();
  const source = join(f.root, 'source'); mkdirSync(source);
  f.git(['init', '--template=', '-b', 'main'], source);
  f.write('file', 'base\n', source); f.commit('submodule baseline', source);
  f.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'module']);
  f.commit('add submodule');
  const module = join(f.repo, 'module');
  f.write('file', 'next\n', module); f.commit('submodule next', module);
  f.write('file', 'dirty\n', module); f.write('new', 'untracked\n', module);
  const before = fingerprint(f.root);
  const result = f.status();
  assert.deepEqual(result.changes, [{ kind: 'tracked', path: 'module', xy: '.M',
    submodule: { commitChanged: true, trackedChanges: true, untrackedChanges: true } }]);
  assert.deepEqual(fingerprint(f.root), before);
  assert.equal(f.status(module).head.state, 'branch');
});

test('SHA-256 repository returns full commit IDs', (t) => {
  const f = fixture(t, 'sha256');
  f.write('file', 'base\n'); f.commit();
  f.write('file', 'changed\n');
  const result = f.status();
  assert.equal(result.repository.objectFormat, 'sha256');
  assert.equal(result.head.commit.length, 64);
  assert.deepEqual(result.summary, { staged: 0, unstaged: 1, untracked: 0, conflicted: 0 });
});

test('tracked type changes and embedded untracked repositories remain visible', (t) => {
  const f = fixture(t);
  f.write('file', 'target\n'); f.commit();
  const blob = f.git(['rev-parse', 'HEAD:file']).stdout.trim();
  f.git(['update-index', '--cacheinfo', '120000,' + blob + ',file']);
  const nested = join(f.repo, 'nested'); mkdirSync(nested);
  f.git(['init', '--template=', '-b', 'main'], nested);
  f.write('inside', 'nested\n', nested); f.commit('nested baseline', nested);
  const result = f.status();
  assert.equal(result.changes.find((v) => v.path === 'file').xy[0], 'T');
  assert.deepEqual(result.changes.find((v) => v.path === 'nested/'), {
    kind: 'untracked', path: 'nested/', xy: null, submodule: null,
  });
});

test('missing Git and damaged HEAD are execution errors, not empty results', (t) => {
  const f = fixture(t);
  f.failure(f.repo, 'GIT_NOT_FOUND', { PATH: '', Path: '' });
  f.write('file', 'base\n'); f.commit();
  f.write('.git/refs/heads/main', 'f'.repeat(40) + '\n');
  f.failure(f.repo, 'GIT_FAILED');
});

test('missing repository, bare repo, Git directory and context overrides fail explicitly', (t) => {
  const f = fixture(t);
  f.failure(f.root, 'NOT_A_REPOSITORY');
  f.failure(join(f.repo, '.git'), 'UNSUPPORTED_REPOSITORY');
  const bare = join(f.root, 'bare'); f.git(['init', '--template=', '--bare', bare]);
  f.failure(bare, 'UNSUPPORTED_REPOSITORY');
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) {
    f.failure(f.repo, 'GIT_CONTEXT_OVERRIDE', { [key]: f.repo });
  }
});
test('invalid options are rejected before Git and stderr errors remain parseable', (t) => {
  const f = fixture(t);
  for (const args of [['--format', 'yaml'], ['extra'], ['--staged']]) {
    const result = f.cli(args, f.root);
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.match(result.stderr, /error:/);
    assert.doesNotMatch(result.stderr, /NOT_A_REPOSITORY/);
  }
  const text = f.cli(['--format', 'text'], f.root);
  assert.equal(text.status, 1); assert.equal(text.stdout, '');
  assert.match(text.stderr, /^NOT_A_REPOSITORY:/);
});
