import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docTopics, listDocTopics, renderDoc, runDocs } from '../.test-build/commands/docs.js';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const assets = fileURLToPath(new URL('../src/shared/i18n/ko/docs/', import.meta.url));
const bundled = fileURLToPath(new URL('../dist/i18n/ko/docs/', import.meta.url));
const run = (cwd, ...args) => {
  const result = spawnSync(process.execPath, [entry, 'docs', ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error); return result;
};
const asset = name => readFileSync(join(assets, name), 'utf8');
// Every topic ships as the format part plus the default guidance; `docs` prints them joined.
const expected = topic => asset(topic + '.md').trimEnd() + '\n\n' + asset(topic + '.default.md').trimEnd() + '\n';

test('bundled docs match the asset source and list every topic', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const names = [...docTopics].flatMap(topic => [topic + '.md', topic + '.default.md']).sort();
  assert.deepEqual(readdirSync(assets).sort(), names);
  assert.deepEqual(readdirSync(bundled).sort(), names);
  const list = run(cwd);
  assert.equal(list.status, 0, list.stderr); assert.equal(list.stderr, '');
  assert.equal(list.stdout, listDocTopics());
  for (const topic of docTopics) {
    assert.match(list.stdout, new RegExp('^' + topic + ' ', 'm'));
    const shown = run(cwd, topic);
    assert.equal(shown.status, 0, shown.stderr); assert.equal(shown.stderr, '');
    assert.equal(shown.stdout, expected(topic));
    assert.match(shown.stdout, /^# /); assert.match(shown.stdout, /\n## 운영 지침\n/);
  }
  assert.match(run(cwd, 'spec').stdout, /set-design/);
  assert.match(run(cwd, 'wiki').stdout, /create-doc/);
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
  assert.match(dto.error.message, /workflow, spec, design, wiki, commit/);
  const extra = run(cwd, 'spec', 'design');
  assert.notEqual(extra.status, 0); assert.equal(extra.stdout, '');
  // Eject needs a project; outside one it refuses and writes nothing.
  const outside = run(cwd, 'wiki', '--eject');
  assert.equal(outside.status, 1); assert.equal(JSON.parse(outside.stderr).error.code, 'NOT_INITIALIZED');
  assert.equal(JSON.parse(run(cwd, '--eject').stderr).error.code, 'TOPIC_REQUIRED');
  assert.deepEqual(readdirSync(cwd), []);
});

test('an override replaces the guidance part only, eject copies it, and an empty override is ignored', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.gitifact')); writeFileSync(join(root, '.gitifact', 'config.json'), '{"schemaVersion":2,"baseline":{"kind":"empty"}}\n');
  const nested = join(root, 'src', 'deep'); mkdirSync(nested, { recursive: true });
  const ejected = run(nested, 'wiki', '--eject');
  assert.equal(ejected.status, 0, ejected.stderr);
  assert.deepEqual(JSON.parse(ejected.stdout), { contract: 'docs', version: 1, ok: true, topic: 'wiki', ejected: '.gitifact/overrides/wiki.md' });
  const path = join(root, '.gitifact', 'overrides', 'wiki.md');
  const copied = readFileSync(path, 'utf8');
  assert.match(copied, /^<!-- gitifact docs wiki /); assert.ok(copied.endsWith(asset('wiki.default.md').trimEnd() + '\n'));
  assert.equal(JSON.parse(run(nested, 'wiki', '--eject').stderr).error.code, 'OVERRIDE_EXISTS');
  // Printed from anywhere inside the project: the format part stays, the guidance is the project's file.
  writeFileSync(path, '## 우리 위키\n\n페이지는 docs/ 아래 구조를 따른다.\n');
  assert.equal(run(nested, 'wiki').stdout, asset('wiki.md').trimEnd() + '\n\n## 우리 위키\n\n페이지는 docs/ 아래 구조를 따른다.\n');
  assert.equal(run(nested, 'spec').stdout, expected('spec'));
  writeFileSync(path, '\n  \n');
  assert.equal(run(nested, 'wiki').stdout, expected('wiki'));
  assert.equal(existsSync(join(root, '.gitifact', 'overrides', 'spec.md')), false);
});

test('in-process docs reads through the injected source', async t => {
  // A folder outside any project, so this repository's own overrides do not replace the injected text.
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const chunks = [];
  const original = process.stdout.write;
  // The test runner also writes its own binary reports through stdout in the same process; keep only text chunks.
  process.stdout.write = chunk => { if (typeof chunk === 'string') chunks.push(chunk); return true; };
  try { await runDocs('design', {}, { cwd, readDoc: async name => 'injected ' + name + '\n' }); }
  finally { process.stdout.write = original; }
  assert.deepEqual(chunks.filter(c => c.startsWith('injected')), ['injected design\n\ninjected design.default\n']);
  assert.equal(await renderDoc('spec', { cwd, readDoc: async name => name }), 'spec\n\nspec.default\n');
  assert.equal(process.exitCode, undefined);
});
