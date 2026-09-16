import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docTopics, listDocTopics, runDocs } from '../.test-build/commands/docs.js';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const assets = fileURLToPath(new URL('../assets/docs/', import.meta.url));
const run = (cwd, ...args) => {
  const result = spawnSync(process.execPath, [entry, 'docs', ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error); return result;
};

test('bundled docs match the asset source and list every topic', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  assert.deepEqual(readdirSync(assets).sort(), [...docTopics].map(topic => topic + '.md').sort());
  const list = run(cwd);
  assert.equal(list.status, 0, list.stderr); assert.equal(list.stderr, '');
  assert.equal(list.stdout, listDocTopics());
  for (const topic of docTopics) {
    assert.match(list.stdout, new RegExp('^' + topic + ' ', 'm'));
    const shown = run(cwd, topic);
    assert.equal(shown.status, 0, shown.stderr); assert.equal(shown.stderr, '');
    assert.equal(shown.stdout, readFileSync(join(assets, topic + '.md'), 'utf8'));
    assert.match(shown.stdout, /^# /);
  }
  assert.match(run(cwd, 'spec').stdout, /set-design/);
  assert.match(run(cwd, 'commit').stdout, /spec commit --file/);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unknown topics fail on stderr without output and docs works outside a repository', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const failure = run(cwd, 'nope');
  assert.equal(failure.status, 1); assert.equal(failure.stdout, '');
  const dto = JSON.parse(failure.stderr);
  assert.deepEqual([dto.contract, dto.version, dto.ok, dto.error.code], ['docs', 1, false, 'UNKNOWN_TOPIC']);
  assert.match(dto.error.message, /workflow, spec, design, product, commit/);
  const extra = run(cwd, 'spec', 'design');
  assert.notEqual(extra.status, 0); assert.equal(extra.stdout, '');
});

test('in-process docs reads through the injected source', async () => {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = chunk => { chunks.push(String(chunk)); return true; };
  try { await runDocs('design', { readDoc: async topic => 'injected ' + topic + '\n' }); }
  finally { process.stdout.write = original; }
  assert.deepEqual(chunks, ['injected design\n']);
  assert.equal(process.exitCode, undefined);
});
