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
const bump = text => text.trim().replace(/^(#{1,5}) /gm, '#$1 ');
const temporary = async t => { const cwd = await mkdtemp(join(tmpdir(), 'gitifact-guide-')); t.after(() => rm(cwd, { recursive: true, force: true })); return cwd; };

test('every guide carries a title and description in frontmatter and no title in its body, in both languages', () => {
  for (const lang of ['ko', 'en']) {
    // One file per topic, plus the wiki policy template.
    assert.deepEqual(readdirSync(assets(lang)).sort(), [...guideTopics.map(topic => topic + '.md'), 'wiki.default.md'].sort(), lang);
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
  for (const topic of guideTopics.filter(topic => topic !== 'wiki')) {
    const shown = run(cwd, 'show', topic);
    assert.equal(shown.status, 0, shown.stderr); assert.equal(shown.stdout, asset(topic + '.md'));
  }
  // Outside a project the wiki guide carries the bundled default policy and says so.
  assert.equal(run(cwd, 'show', 'wiki').stdout, asset('wiki.md').trimEnd() + '\n\n## 운영 방침 (기본값. .gitifact/wiki/README.md가 없어 내장 방침을 싣는다)\n\n' + bump(asset('wiki.default.md')) + '\n');
  assert.deepEqual(readdirSync(cwd), []);
});

test('unknown topics and removed forms fail on stderr without output', async t => {
  const cwd = await temporary(t);
  const failure = run(cwd, 'show', 'nope', '--format', 'json');
  assert.equal(failure.status, 1); assert.equal(failure.stdout, '');
  const dto = JSON.parse(failure.stderr);
  assert.deepEqual([dto.contract, dto.version, dto.ok, dto.error.code], ['guide', 1, false, 'UNKNOWN_TOPIC']);
  assert.match(dto.error.message, /workflow, spec, design, wiki, writing, commit/);
  const text = run(cwd, 'show', 'nope');
  assert.equal(text.status, 1); assert.match(text.stderr, /^UNKNOWN_TOPIC: /);
  assert.notEqual(run(cwd, 'show', 'spec', 'design').status, 0);
  // The old `docs <topic>` form is gone.
  const old = spawnSync(process.execPath, [entry, 'docs', 'spec'], { cwd, encoding: 'utf8' });
  assert.notEqual(old.status, 0); assert.equal(old.stdout, '');
  assert.deepEqual(readdirSync(cwd), []);
});

test("the project's wiki README is the wiki policy, found from any folder inside the project", async t => {
  const root = await temporary(t);
  mkdirSync(join(root, '.gitifact', 'wiki'), { recursive: true });
  writeFileSync(join(root, '.gitifact', 'config.json'), '{"schemaVersion":3,"baseline":{"kind":"empty"}}\n');
  writeFileSync(join(root, '.gitifact', 'wiki', 'README.md'), '---\nid: W-abcdefghij\ntitle: 우리 위키\ndescription: 위키 운영\n---\n\n규칙은 rules/에 둔다.\n\n## 결정\n\n```md\n# 코드 블록 속 제목\n```\n');
  const nested = join(root, 'src', 'deep'); mkdirSync(nested, { recursive: true });
  // Frontmatter is dropped, headings move one level down, fenced examples stay as written.
  assert.equal(run(nested, 'show', 'wiki').stdout, asset('wiki.md').trimEnd() + '\n\n## 운영 방침 (.gitifact/wiki/README.md)\n\n규칙은 rules/에 둔다.\n\n### 결정\n\n```md\n# 코드 블록 속 제목\n```\n');
  // Other topics are never replaced by project files.
  assert.equal(run(nested, 'show', 'spec').stdout, asset('spec.md'));
  // An empty README falls back to the bundled policy.
  writeFileSync(join(root, '.gitifact', 'wiki', 'README.md'), '---\nid: W-abcdefghij\ntitle: 비어 있음\ndescription: 비어 있음\n---\n');
  assert.match(run(nested, 'show', 'wiki').stdout, /## 운영 방침 \(기본값\./);
});

test('in-process guides read through the injected source', async t => {
  // A folder outside any project, so this repository's own README does not replace the injected text.
  const cwd = await temporary(t);
  const chunks = [];
  const original = process.stdout.write;
  // The test runner also writes its own binary reports through stdout in the same process; keep only text chunks.
  process.stdout.write = chunk => { if (typeof chunk === 'string') chunks.push(chunk); return true; };
  try { await runGuideShow('design', { format: 'text' }, { cwd, readGuide: async name => 'injected ' + name + '\n' }); }
  finally { process.stdout.write = original; }
  assert.deepEqual(chunks.filter(c => c.startsWith('injected')), ['injected design\n']);
  assert.equal(await renderGuide('wiki', { cwd, readGuide: async name => name === 'wiki' ? 'format' : '## 기본' }, 'ko'), 'format\n\n## 운영 방침 (기본값. .gitifact/wiki/README.md가 없어 내장 방침을 싣는다)\n\n### 기본\n');
  assert.equal(process.exitCode, undefined);
});
