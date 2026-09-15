import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepositoryReader } from '../.test-build/adapters/git/repository-reader.js';
import { createGitRunner, classifyGitFailure } from '../.test-build/adapters/git/run-git.js';

const oid = 'a'.repeat(40);
const status = (blob) => Buffer.from('# branch.oid ' + oid + '\0# branch.head main\0'
  + '1 MM N... 100644 100644 100644 ' + oid + ' ' + blob.repeat(40) + ' file\0');
function fakeRun(statuses, locations = []) {
  let statusIndex = 0;
  let locationIndex = 0;
  return async (args, context) => {
    assert.equal(context.env.GIT_OPTIONAL_LOCKS, '0');
    assert.equal(context.env.GIT_NO_LAZY_FETCH, '1');
    assert.ok(context.timeoutMs > 0);
    if (args.includes('status')) return statuses[statusIndex++];
    const values = {
      '--is-bare-repository': 'false', '--is-inside-git-dir': 'false', '--is-inside-work-tree': 'true',
      '--show-toplevel': '/repo', '--absolute-git-dir': '/repo/.git', '--git-common-dir': '/repo/.git',
      '--show-object-format': 'sha1',
    };
    const fields = args.filter(arg => Object.hasOwn(values, arg));
    return Buffer.from(fields.map(arg => arg === '--show-toplevel' && locations.length
      ? locations[locationIndex++] : values[arg]).join('\n') + '\n');
  };
}
test('same status count and XY with changed staged content causes a full retry', async () => {
  const reader = createRepositoryReader('/repo', { env: {}, run: fakeRun([status('b'), status('c'), status('d'), status('d')]) });
  const value = await reader.read();
  assert.equal(value.changes[0].xy, 'MM');
});

test('repository discovery batches flags while retaining newline paths and snapshot retries', async () => {
  let calls = 0;
  const run = fakeRun([status('b'), status('b')]);
  await createRepositoryReader('/repo', { env: {}, run: async (...args) => { calls++; return run(...args); } }).read();
  assert.equal(calls, 4, 'two identity queries and two status reads');
  const path = '/repo\nwith-newline';
  const value = await createRepositoryReader(path, { env: {}, run: fakeRun([status('b'), status('b')], Array(4).fill(path)) }).read();
  assert.equal(value.repository.rootPath, path);
});
test('repeated status or repository identity changes fail rather than return a mix', async () => {
  await assert.rejects(createRepositoryReader('/repo', {
    env: {}, run: fakeRun([status('b'), status('c'), status('b'), status('c')]),
  }).read(), { code: 'REPOSITORY_CHANGED' });
  await assert.rejects(createRepositoryReader('/repo', {
    env: {}, run: fakeRun([status('b'), status('b'), status('b'), status('b')], ['/repo', '/other', '/repo', '/other']),
  }).read(), { code: 'REPOSITORY_CHANGED' });
});
test('context overrides and elapsed attempt budget fail before further Git reads', async () => {
  await assert.rejects(createRepositoryReader('/repo', { env: { GIT_INDEX_FILE: '' },
    run: async () => assert.fail('must not run') }).read(), { code: 'GIT_CONTEXT_OVERRIDE' });
  let clock = 0;
  await assert.rejects(createRepositoryReader('/repo', { env: {},
    monotonicNow: () => clock, attemptTimeoutMs: 15,
    run: async () => { clock = 16; return Buffer.from('false\n'); },
  }).read(), { code: 'READ_LIMIT_EXCEEDED' });
});
test('Git failures distinguish missing repository, unsupported option and permission/corruption', () => {
  assert.equal(classifyGitFailure('fatal: not a git repository (or any of the parent directories): .git', 128).code, 'NOT_A_REPOSITORY');
  assert.equal(classifyGitFailure("error: unknown option 'porcelain=v2'", 129).code, 'GIT_UNSUPPORTED');
  for (const reason of ['fatal: detected dubious ownership', 'fatal: bad object HEAD', 'fatal: Permission denied']) {
    assert.equal(classifyGitFailure(reason, 128).code, 'GIT_FAILED');
  }
});
test('process runner enforces output limits and execution timeout', async () => {
  const invoke = createGitRunner(process.execPath);
  const context = { cwd: process.cwd(), env: process.env, timeoutMs: 5000, maxBytes: 1024 };
  await assert.rejects(invoke(['-e', 'process.stdout.write("x".repeat(2048))'], context), { code: 'READ_LIMIT_EXCEEDED' });
  await assert.rejects(invoke(['-e', 'process.stderr.write("x".repeat(2048))'], context), { code: 'READ_LIMIT_EXCEEDED' });
  await assert.rejects(invoke(['-e', 'setInterval(() => {}, 1000)'], { ...context, timeoutMs: 100 }), { code: 'READ_LIMIT_EXCEEDED' });
});
test('process runner classifies absent executable without leaking raw error', async () => {
  await assert.rejects(createGitRunner('gitifact-nonexistent-git-executable')([], {
    cwd: process.cwd(), env: process.env, timeoutMs: 1000, maxBytes: 1024,
  }), { code: 'GIT_NOT_FOUND' });
});

test('missing working directory is not reported as a missing Git executable', async () => {
  await assert.rejects(createGitRunner(process.execPath)(['--version'], {
    cwd: join(tmpdir(), randomUUID()), env: process.env, timeoutMs: 1000, maxBytes: 1024,
  }), { code: 'GIT_FAILED' });
});
