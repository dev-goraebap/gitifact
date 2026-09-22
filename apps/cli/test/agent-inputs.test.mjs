import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { renderDocumentFile } from '@gitifact/core';
import { projectFixture } from './git-fixture.mjs';
import { discardAgentInput, prepareAgentInputs } from '../.test-build/adapters/filesystem/agent-inputs.js';

const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const R = 'R-bbbbbbbbbb';
const paths = ['.gitifact/history.jsonl', '.gitifact/spec/posts/index.md', '.gitifact/spec/posts/requirements/save.md', 'app.js'];

function setup(t) {
  const f = projectFixture(t);
  for (const doc of [
    { kind: 'feature', path: paths[1], id: 'S-aaaaaaaaaa', feature: 'posts', title: '게시물', description: '게시물 작성', body: '게시물 기능.' },
    { kind: 'requirement', path: paths[2], id: R, feature: 'posts', order: 10, title: '저장', description: '제목을 입력해 저장한다', body: '작성자로서 저장하고 싶다.' },
  ]) { mkdirSync(dirname(join(f.repo, doc.path)), { recursive: true }); writeFileSync(join(f.repo, doc.path), renderDocumentFile(doc)); }
  f.write('app.js', 'export const save = title => !!title;\n');
  return f;
}
const input = () => ({ reasons: [{ docs: [R], reason: '제목 없는 저장을 방지' }], paths, message: 'Add post saving', authorization });
const clean = f => assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, '');

test('changes list reports the input path under the system temporary folder', t => {
  const f = setup(t);
  const { inputs } = f.ok(['changes', 'list']);
  assert.ok(inputs.commit.startsWith(join(f.root, 'tmp', 'gitifact')), inputs.commit);
  assert.ok(existsSync(dirname(inputs.commit)));
  assert.deepEqual(Object.keys(inputs), ['commit']);
});

test('commit inputs survive dry runs and rejected commits, are removed after the commit, and outside files are kept', t => {
  const f = setup(t);
  const { inputs } = f.ok(['changes', 'list']);
  writeFileSync(inputs.commit, JSON.stringify(input()));
  assert.equal(f.ok(['changes', 'commit', '--file', inputs.commit, '--dry-run']).inputRemoved, undefined);
  assert.ok(existsSync(inputs.commit));
  const hook = join(f.repo, '.git/hooks/pre-commit'); writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  assert.equal(f.run(['changes', 'commit', '--file', inputs.commit]).status, 1);
  assert.equal(f.git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
  assert.ok(existsSync(inputs.commit));
  writeFileSync(hook, '#!/bin/sh\nexit 0\n');
  const committed = f.ok(['changes', 'commit', '--file', inputs.commit]);
  assert.equal(committed.outcome, 'committed'); assert.equal(committed.inputRemoved, true);
  assert.equal(existsSync(inputs.commit), false);
  // Files outside the managed folder are never deleted.
  f.write('app.js', 'export const save = title => !!title.trim();\n');
  const outside = join(f.root, 'outside.json');
  writeFileSync(outside, JSON.stringify({ paths: ['app.js'], message: 'Trim', authorization }));
  assert.equal(f.ok(['changes', 'commit', '--file', outside]).inputRemoved, false);
  assert.ok(existsSync(outside));
});

test('commit reads standard input with --file -', t => {
  const f = setup(t);
  const committed = f.ok(['changes', 'commit', '--file', '-'], { input: JSON.stringify(input()) });
  assert.equal(committed.outcome, 'committed'); assert.equal(committed.inputRemoved, undefined);
  assert.equal(f.run(['changes', 'commit', '--file', '-'], { input: 'not json' }).status, 1);
});

test('an unwritable system temporary folder falls back to .gitifact/tmp that ignores itself', t => {
  const f = setup(t); f.commit('Add posts');
  const blocked = join(f.root, 'not-a-folder'); writeFileSync(blocked, '');
  const env = { TEMP: blocked, TMP: blocked, TMPDIR: blocked };
  const { inputs } = f.ok(['changes', 'list'], { env });
  const fallback = join(f.repo, '.gitifact', 'tmp');
  assert.equal(inputs.commit, join(fallback, 'commit.json'));
  assert.equal(readFileSync(join(fallback, '.gitignore'), 'utf8'), '*\n');
  clean(f);
  f.write('app.js', 'export const save = title => !!title.trim();\n');
  writeFileSync(inputs.commit, JSON.stringify({ paths: ['app.js'], message: 'Trim', authorization }));
  assert.equal(f.ok(['changes', 'commit', '--file', inputs.commit], { env }).inputRemoved, true);
  assert.deepEqual(readdirSync(fallback), ['.gitignore']);
  clean(f);
});

test('only files older than seven days in the managed folder are pruned', async t => {
  const f = setup(t);
  const controls = { tmpdir: () => join(f.root, 'injected'), now: () => Date.parse('2026-09-20T00:00:00Z') };
  const inputs = await prepareAgentInputs(f.repo, controls);
  const folder = dirname(inputs.commit);
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
