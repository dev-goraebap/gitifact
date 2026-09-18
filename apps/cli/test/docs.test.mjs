import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
const bump = text => text.trim().replace(/^(#{1,5}) /gm, '#$1 ');

test('bundled docs match the asset source and list every topic', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  // One file per topic, plus the wiki policy template.
  const names = [...docTopics.map(topic => topic + '.md'), 'wiki.default.md'].sort();
  assert.deepEqual(readdirSync(assets).sort(), names);
  assert.deepEqual(readdirSync(bundled).sort(), names);
  const list = run(cwd);
  assert.equal(list.status, 0, list.stderr); assert.equal(list.stderr, '');
  assert.equal(list.stdout, listDocTopics());
  for (const topic of docTopics.filter(topic => topic !== 'wiki')) {
    assert.match(list.stdout, new RegExp('^' + topic + ' ', 'm'));
    const shown = run(cwd, topic);
    assert.equal(shown.status, 0, shown.stderr); assert.equal(shown.stderr, '');
    assert.equal(shown.stdout, asset(topic + '.md'));
  }
  // Outside a project the wiki topic carries the bundled default policy and says so.
  const wiki = run(cwd, 'wiki');
  assert.equal(wiki.stdout, asset('wiki.md').trimEnd() + '\n\n## 운영 방침 (기본값. .gitifact/wiki/README.md가 없어 내장 방침을 싣는다)\n\n' + bump(asset('wiki.default.md')) + '\n');
  assert.match(run(cwd, 'spec').stdout, /set-design/);
  assert.match(wiki.stdout, /create-doc/);
  assert.match(run(cwd, 'commit').stdout, /spec commit --file/);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unknown topics and removed options fail on stderr without output', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const failure = run(cwd, 'nope');
  assert.equal(failure.status, 1); assert.equal(failure.stdout, '');
  const dto = JSON.parse(failure.stderr);
  assert.deepEqual([dto.contract, dto.version, dto.ok, dto.error.code], ['docs', 1, false, 'UNKNOWN_TOPIC']);
  assert.match(dto.error.message, /workflow, spec, design, wiki, commit/);
  assert.notEqual(run(cwd, 'spec', 'design').status, 0);
  // Guidance overrides were removed; the option no longer exists.
  const eject = run(cwd, 'wiki', '--eject');
  assert.notEqual(eject.status, 0); assert.equal(eject.stdout, '');
  assert.deepEqual(readdirSync(cwd), []);
});

test("the project's wiki README is the wiki policy, found from any folder inside the project", async t => {
  const root = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.gitifact', 'wiki'), { recursive: true });
  writeFileSync(join(root, '.gitifact', 'config.json'), '{"schemaVersion":2,"baseline":{"kind":"empty"}}\n');
  writeFileSync(join(root, '.gitifact', 'wiki', 'README.md'), '---\nid: W-abcdefghij\n---\n\n# 우리 위키\n\n규칙은 rules/에 둔다.\n\n## 결정\n\n```md\n# 코드 블록 속 제목\n```\n');
  const nested = join(root, 'src', 'deep'); mkdirSync(nested, { recursive: true });
  // Frontmatter and title are dropped, headings move one level down, fenced examples stay as written.
  assert.equal(run(nested, 'wiki').stdout, asset('wiki.md').trimEnd() + '\n\n## 운영 방침 (.gitifact/wiki/README.md)\n\n규칙은 rules/에 둔다.\n\n### 결정\n\n```md\n# 코드 블록 속 제목\n```\n');
  // Other topics are never replaced by project files.
  assert.equal(run(nested, 'spec').stdout, asset('spec.md'));
  // An empty README falls back to the bundled policy.
  writeFileSync(join(root, '.gitifact', 'wiki', 'README.md'), '---\nid: W-abcdefghij\n---\n\n# 비어 있음\n');
  assert.match(run(nested, 'wiki').stdout, /## 운영 방침 \(기본값\./);
});

test('in-process docs reads through the injected source', async t => {
  // A folder outside any project, so this repository's own README does not replace the injected text.
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-docs-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const chunks = [];
  const original = process.stdout.write;
  // The test runner also writes its own binary reports through stdout in the same process; keep only text chunks.
  process.stdout.write = chunk => { if (typeof chunk === 'string') chunks.push(chunk); return true; };
  try { await runDocs('design', { cwd, readDoc: async name => 'injected ' + name + '\n' }); }
  finally { process.stdout.write = original; }
  assert.deepEqual(chunks.filter(c => c.startsWith('injected')), ['injected design\n']);
  assert.equal(await renderDoc('wiki', { cwd, readDoc: async name => name === 'wiki' ? 'format' : '## 기본' }), 'format\n\n## 운영 방침 (기본값. .gitifact/wiki/README.md가 없어 내장 방침을 싣는다)\n\n### 기본\n');
  assert.equal(process.exitCode, undefined);
});
