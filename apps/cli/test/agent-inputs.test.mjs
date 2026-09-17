import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './git-fixture.mjs';
import { discardAgentInput, prepareAgentInputs } from '../.test-build/adapters/filesystem/agent-inputs.js';

const exe = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const cli = (f, args, env = {}, input) => spawnSync(process.execPath, [exe, ...args], { cwd: f.repo, env: { ...f.env, ...env }, encoding: 'utf8', timeout: 45000, input });
const ok = r => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const create = [{ type: 'create', feature: 'posts', title: '게시물' }, { type: 'add', feature: 'posts', title: '저장', body: '제목을 입력해 저장합니다.' }];

function setup(t) {
  const f = fixture(t);
  for (const [k, v] of [['user.name', 'Tryce fixture'], ['user.email', 'fixture@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) f.git(['config', k, v]);
  mkdirSync(join(f.repo, '.git/hooks')); ok(cli(f, ['init'])); f.commit('Initialize gitifact');
  return f;
}
const clean = f => assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, '');

test('working reports input paths under the system temporary folder and a successful save removes the input', t => {
  const f = setup(t);
  const working = ok(cli(f, ['spec', 'working']));
  assert.ok(working.inputs.save.startsWith(join(f.root, 'tmp', 'gitifact')), working.inputs.save);
  assert.equal(dirname(working.inputs.commit), dirname(working.inputs.save));
  assert.ok(existsSync(dirname(working.inputs.save)));
  assert.deepEqual(Object.keys(ok(cli(f, ['spec', 'working', '--stamp']))).sort(), ['contract', 'inputs', 'ok', 'stamp', 'version']);

  // A stale save fails and keeps the input for the retry.
  writeFileSync(working.inputs.save, JSON.stringify({ expected: 'stale', operations: create }));
  assert.equal(cli(f, ['spec', 'save', '--file', working.inputs.save]).status, 1);
  assert.ok(existsSync(working.inputs.save));

  writeFileSync(working.inputs.save, JSON.stringify({ expected: working.stamp, operations: create }));
  const saved = ok(cli(f, ['spec', 'save', '--file', working.inputs.save]));
  assert.equal(saved.inputRemoved, true); assert.equal(existsSync(working.inputs.save), false);

  // Files outside the managed folder are never deleted.
  const outside = join(f.root, 'outside.json');
  writeFileSync(outside, JSON.stringify({ expected: ok(cli(f, ['spec', 'working'])).stamp, operations: [{ type: 'add', feature: 'posts', title: '삭제', body: '게시물을 삭제합니다.' }] }));
  assert.equal(ok(cli(f, ['spec', 'save', '--file', outside])).inputRemoved, false);
  assert.ok(existsSync(outside));
});

test('an unwritable system temporary folder falls back to .gitifact/tmp that ignores itself', t => {
  const f = setup(t);
  const blocked = join(f.root, 'not-a-folder'); writeFileSync(blocked, '');
  const env = { TEMP: blocked, TMP: blocked, TMPDIR: blocked };
  const working = ok(cli(f, ['spec', 'working'], env));
  const fallback = join(f.repo, '.gitifact', 'tmp');
  assert.equal(working.inputs.save, join(fallback, 'save.json'));
  assert.equal(readFileSync(join(fallback, '.gitignore'), 'utf8'), '*\n');
  clean(f);
  writeFileSync(working.inputs.save, JSON.stringify({ expected: working.stamp, operations: create }));
  clean(f);
  assert.equal(ok(cli(f, ['spec', 'save', '--file', working.inputs.save], env)).inputRemoved, true);
  assert.deepEqual(readdirSync(fallback), ['.gitignore']);
});

test('commit inputs survive dry runs and rejected commits and are removed after the commit', t => {
  const f = setup(t);
  const working = ok(cli(f, ['spec', 'working']));
  writeFileSync(working.inputs.save, JSON.stringify({ expected: working.stamp, operations: create }));
  const id = ok(cli(f, ['spec', 'save', '--file', working.inputs.save])).results[1].id;
  f.write('app.js', 'export const save = title => !!title;\n');
  const { inputs } = ok(cli(f, ['spec', 'changes']));
  writeFileSync(inputs.commit, JSON.stringify({ reasons: [{ requirements: [id], reason: '제목 없는 저장을 방지' }],
    paths: ['.gitifact/spec/posts/requirements.md', '.gitifact/spec/posts/history.jsonl', 'app.js'], message: 'Add post saving', authorization }));
  assert.equal(ok(cli(f, ['spec', 'commit', '--file', inputs.commit, '--dry-run'])).inputRemoved, undefined);
  assert.ok(existsSync(inputs.commit));
  const hook = join(f.repo, '.git/hooks/pre-commit'); writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  const rejected = cli(f, ['spec', 'commit', '--file', inputs.commit]);
  assert.equal(rejected.status, 1);
  assert.equal(f.git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
  assert.ok(existsSync(inputs.commit));
  writeFileSync(hook, '#!/bin/sh\nexit 0\n');
  const committed = ok(cli(f, ['spec', 'commit', '--file', inputs.commit]));
  assert.equal(committed.outcome, 'committed'); assert.equal(committed.inputRemoved, true);
  assert.equal(existsSync(inputs.commit), false);
});

test('save reads standard input with --file -', t => {
  const f = setup(t);
  const { stamp } = ok(cli(f, ['spec', 'working', '--stamp']));
  const saved = ok(cli(f, ['spec', 'save', '--file', '-'], {}, JSON.stringify({ expected: stamp, operations: create })));
  assert.equal(saved.results.length, 2); assert.equal(saved.inputRemoved, undefined);
  assert.equal(cli(f, ['spec', 'save', '--file', '-'], {}, 'not json').status, 1);
});

test('working narrows to one feature or to IDs and titles', t => {
  const f = setup(t);
  const { stamp } = ok(cli(f, ['spec', 'working', '--stamp']));
  ok(cli(f, ['spec', 'save', '--file', '-'], {}, JSON.stringify({ expected: stamp, operations: [...create, { type: 'create', feature: 'users', title: '사용자' }] })));
  const feature = ok(cli(f, ['spec', 'working', '--feature', 'posts']));
  assert.deepEqual(feature.specs.map(s => s.path), ['.gitifact/spec/posts/requirements.md']);
  assert.deepEqual(feature.documents, []); assert.equal(feature.specs[0].requirements[0].body, '제목을 입력해 저장합니다.');
  const ids = ok(cli(f, ['spec', 'working', '--ids']));
  assert.equal(ids.specs.length, 2);
  assert.deepEqual(Object.keys(ids.specs.find(s => s.path.includes('/posts/')).requirements[0]).sort(), ['id', 'title']);
  const missing = cli(f, ['spec', 'working', '--feature', 'nothing']);
  assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stderr).error.code, 'INVALID_SPEC_PREVIEW');
  assert.notEqual(cli(f, ['spec', 'working', '--stamp', '--ids']).status, 0);
});

test('only files older than seven days in the managed folder are pruned', async t => {
  const f = setup(t);
  const controls = { tmpdir: () => join(f.root, 'injected'), now: () => Date.parse('2026-09-20T00:00:00Z') };
  const inputs = await prepareAgentInputs(f.repo, controls);
  const folder = dirname(inputs.save);
  const old = join(folder, 'old.json'); const fresh = join(folder, 'fresh.json');
  writeFileSync(old, '{}'); writeFileSync(fresh, '{}');
  utimesSync(old, new Date('2026-09-12T00:00:00Z'), new Date('2026-09-12T00:00:00Z'));
  utimesSync(fresh, new Date('2026-09-14T00:00:00Z'), new Date('2026-09-14T00:00:00Z'));
  const outside = join(f.root, 'injected', 'gitifact', 'old.json'); writeFileSync(outside, '{}');
  utimesSync(outside, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
  await prepareAgentInputs(f.repo, controls);
  assert.deepEqual(readdirSync(folder).sort(), ['fresh.json']);
  assert.ok(existsSync(outside));
  assert.equal(await discardAgentInput(f.repo, outside, controls), false);
  assert.equal(await discardAgentInput(f.repo, fresh, controls), true);
});
