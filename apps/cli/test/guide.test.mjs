import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guideSummary, guideTopics, renderGuide, runGuideShow } from '../.test-build/commands/guide.js';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const assets = lang => fileURLToPath(new URL(`../src/shared/i18n/${lang}/docs/`, import.meta.url));
const bundled = fileURLToPath(new URL('../dist/i18n/ko/docs/', import.meta.url));
const run = (cwd, ...args) => {
  const result = spawnSync(process.execPath, [entry, 'guide', ...args], { cwd, env: { ...process.env, GITIFACT_LANG: 'ko' }, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error); return result;
};
const asset = name => readFileSync(join(assets('ko'), name), 'utf8');
const temporary = async t => { const cwd = await mkdtemp(join(tmpdir(), 'gitifact-guide-')); t.after(() => rm(cwd, { recursive: true, force: true })); return cwd; };

test('every guide carries a title and description in frontmatter and no title in its body, in both languages', () => {
  for (const lang of ['ko', 'en']) {
    // One file per topic and nothing else.
    assert.deepEqual(readdirSync(assets(lang)).sort(), guideTopics.map(topic => topic + '.md').sort(), lang);
    for (const topic of guideTopics) {
      const source = readFileSync(join(assets(lang), topic + '.md'), 'utf8');
      const { title, description } = guideSummary(source);
      assert.ok(title && description, lang + ' ' + topic);
      assert.doesNotMatch(source.slice(source.indexOf('\n---\n') + 5).trimStart(), /^# /, lang + ' ' + topic);
    }
  }
});

test('guide list names each topic with its frontmatter, and guide show prints the shipped file', async t => {
  const cwd = await temporary(t);
  assert.deepEqual(readdirSync(bundled).sort(), readdirSync(assets('ko')).sort());
  const list = run(cwd, 'list');
  assert.equal(list.status, 0, list.stderr); assert.equal(list.stderr, '');
  for (const topic of guideTopics) {
    const { title, description } = guideSummary(asset(topic + '.md'));
    assert.match(list.stdout, new RegExp('^' + topic + ' +' + title + ' — ' + description.replace(/[()]/g, '\\$&') + '$', 'm'));
  }
  const json = JSON.parse(run(cwd, 'list', '--format', 'json').stdout);
  assert.deepEqual([json.contract, json.version, json.ok, json.topics.map(g => g.name)], ['guide', 1, true, [...guideTopics]]);
  for (const topic of guideTopics) {
    const shown = run(cwd, 'show', topic);
    assert.equal(shown.status, 0, shown.stderr); assert.equal(shown.stdout, asset(topic + '.md'));
  }
  assert.deepEqual(readdirSync(cwd), []);
});

test('unknown topics and removed forms fail on stderr without output', async t => {
  const cwd = await temporary(t);
  const failure = run(cwd, 'show', 'nope', '--format', 'json');
  assert.equal(failure.status, 1); assert.equal(failure.stdout, '');
  const dto = JSON.parse(failure.stderr);
  assert.deepEqual([dto.contract, dto.version, dto.ok, dto.error.code], ['guide', 1, false, 'UNKNOWN_TOPIC']);
  assert.match(dto.error.message, /workflow, spec, design, instructions, records, writing, commit, migrate/);
  // Instructions replaced the wiki, and its guide with it.
  assert.match(run(cwd, 'show', 'wiki').stderr, /^UNKNOWN_TOPIC: /);
  const text = run(cwd, 'show', 'nope');
  assert.equal(text.status, 1); assert.match(text.stderr, /^UNKNOWN_TOPIC: /);
  assert.notEqual(run(cwd, 'show', 'spec', 'design').status, 0);
  // The old `docs <topic>` form is gone.
  const old = spawnSync(process.execPath, [entry, 'docs', 'spec'], { cwd, encoding: 'utf8' });
  assert.notEqual(old.status, 0); assert.equal(old.stdout, '');
  assert.deepEqual(readdirSync(cwd), []);
});

test('a wiki README left in a project changes no guide', async t => {
  const root = await temporary(t);
  mkdirSync(join(root, '.gitifact', 'wiki'), { recursive: true });
  writeFileSync(join(root, '.gitifact', 'config.json'), '{"schemaVersion":3,"baseline":{"kind":"empty"}}\n');
  writeFileSync(join(root, '.gitifact', 'wiki', 'README.md'), '---\nid: W-abcdefghij\ntitle: 우리 위키\ndescription: 위키 운영\n---\n\n규칙은 rules/에 둔다.\n');
  const nested = join(root, 'src', 'deep'); mkdirSync(nested, { recursive: true });
  for (const topic of guideTopics) assert.equal(run(nested, 'show', topic).stdout, asset(topic + '.md'), topic);
});

test('in-process guides read through the injected source', async () => {
  const chunks = [];
  const original = process.stdout.write;
  // The test runner also writes its own binary reports through stdout in the same process; keep only text chunks.
  process.stdout.write = chunk => { if (typeof chunk === 'string') chunks.push(chunk); return true; };
  try { await runGuideShow('design', { format: 'text' }, { readGuide: async name => 'injected ' + name + '\n' }); }
  finally { process.stdout.write = original; }
  assert.deepEqual(chunks.filter(c => c.startsWith('injected')), ['injected design\n']);
  assert.equal(await renderGuide('instructions', { readGuide: async name => name + '\n\n' }, 'ko'), 'instructions\n');
  assert.equal(process.exitCode, undefined);
});
