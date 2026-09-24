import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectFixture } from './git-fixture.mjs';

const I = 'I-aaaaaaaaaa';
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const instruction = (id = I, body = '계층을 지킨다.') => `---\nid: ${id}\ntitle: CLI 규칙\ndescription: CLI 계층 규칙. apps/cli를 고칠 때 읽는다\n---\n\n${body}\n`;
function put(f, path, content) {
  const file = join(f.repo, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
}
function commit(f, value) {
  const p = join(f.root, 'input.json'); writeFileSync(p, JSON.stringify(value));
  const result = f.run(['changes', 'commit', '--file', p, '--format', 'json']);
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}

test('docs new instruction writes the folder and index.md as a draft with an I- ID', t => {
  const f = projectFixture(t);
  const made = f.ok(['docs', 'new', 'instruction', 'cli-rules', '--title', 'CLI 규칙', '--description', 'CLI 계층: apps/cli를 고칠 때 읽는다']);
  assert.match(made.id, /^I-[a-z2-7]{10}$/);
  assert.equal(made.path, '.gitifact/instructions/cli-rules/index.md');
  const text = readFileSync(join(f.repo, made.path), 'utf8');
  assert.match(text, /^---\nid: I-[a-z2-7]{10}\ntitle: CLI 규칙\ndescription: "CLI 계층: apps\/cli를 고칠 때 읽는다"\ndraft: true\n---\n\n/);
  assert.deepEqual(JSON.parse(f.run(['docs', 'check', '--format', 'json']).stdout).problems.map(p => p.code), ['DOC_DRAFT']);
  assert.match(f.run(['docs', 'new', 'instruction', 'Bad_Name', '--title', 'x', '--description', 'x']).stderr, /^INVALID_PATH: /);
  assert.match(f.run(['docs', 'new', 'instruction', 'a/b', '--title', 'x', '--description', 'x']).stderr, /^INVALID_PATH: /);
  assert.match(f.run(['docs', 'new', 'instruction', 'cli-rules', '--title', 'x', '--description', 'x']).stderr, /^DOCUMENT_EXISTS: /);
});

test('instructions are listed, shown with their files, searched and checked like other documents', t => {
  const f = projectFixture(t);
  put(f, '.gitifact/instructions/cli-rules/index.md', instruction(I, '계층을 지킨다. [결정 표](references/decisions.md) · [없는 파일](references/missing.md)'));
  put(f, '.gitifact/instructions/cli-rules/references/decisions.md', '| 결정 | 이유 |\n');
  put(f, '.gitifact/instructions/cli-rules/scripts/check.sh', 'echo ok\n');
  assert.equal(f.run(['docs', 'list', '--kind', 'instruction']).stdout, `[지침]\n  ${I} CLI 규칙 (cli-rules) — CLI 계층 규칙. apps/cli를 고칠 때 읽는다\n`);
  assert.deepEqual(f.ok(['docs', 'list']).instructions, [{ id: I, name: 'cli-rules', path: '.gitifact/instructions/cli-rules/index.md', title: 'CLI 규칙', description: 'CLI 계층 규칙. apps/cli를 고칠 때 읽는다' }]);
  assert.deepEqual(f.ok(['docs', 'list', '--kind', 'spec']).instructions, []);
  const shown = f.run(['docs', 'show', I]).stdout;
  assert.match(shown, /^== I-aaaaaaaaaa \.gitifact\/instructions\/cli-rules\/index\.md\n---\nid: I-aaaaaaaaaa\n/);
  assert.match(shown, /\n-- 파일\n  references\/decisions\.md\n  scripts\/check\.sh\n$/);
  assert.deepEqual(f.ok(['docs', 'search', '계층을']).hits.map(h => [h.id, h.kind]), [[I, 'instruction']]);
  // A link into the folder counts as found; a missing file is a warning.
  assert.deepEqual(f.ok(['docs', 'check']).warnings.map(w => w.code + ' ' + w.message.split(': ').at(-1)), ['MISSING_LINK_TARGET references/missing.md']);

  // A design names the instruction it follows; the instruction never names a spec.
  put(f, '.gitifact/spec/posts/index.md', '---\nid: S-aaaaaaaaaa\ntitle: 게시물\ndescription: 게시물 기능\n---\n\n게시물.\n');
  put(f, '.gitifact/spec/posts/design/overview.md', `---\nid: D-aaaaaaaaaa\ntitle: 개요\ndescription: 저장 흐름\norder: 10\nsources:\n  - id: ${I}\n---\n\n저장한다.\n`);
  assert.match(f.run(['docs', 'show', I]).stdout, /-- 가리키는 문서\n  D-aaaaaaaaaa 개요/);
  put(f, '.gitifact/instructions/cli-rules/references/rules.md', '[저장 설계](../../../spec/posts/design/overview.md)\n');
  put(f, '.gitifact/instructions/orphan/references/a.md', 'a\n');
  const result = f.run(['docs', 'check', '--format', 'json']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).problems.map(p => p.code + ' ' + p.path), [
    'INSTRUCTION_SPEC_LINK .gitifact/instructions/cli-rules/references/rules.md', 'INSTRUCTION_INDEX_REQUIRED .gitifact/instructions/orphan/index.md',
  ]);
});

test('an instruction commits with its folder and reason, carries a Doc trailer, and keeps its history through a rename', t => {
  const f = projectFixture(t);
  put(f, '.gitifact/instructions/cli-rules/index.md', instruction());
  put(f, '.gitifact/instructions/cli-rules/references/decisions.md', '결정\n');
  assert.deepEqual(f.ok(['changes', 'list']).changes.map(c => [c.id, c.kind, c.types]), [[I, 'instruction', ['created']]]);
  const record = (id, reason) => { put(f, `.gitifact/records/20260924/${id}.md`, `---\nid: ${id}\ntitle: ${reason}\ndocs:\n  - ${I}\n---\n\n## 맥락\n\n${reason}\n\n## 결정\n\n${reason}\n`); return `.gitifact/records/20260924/${id}.md`; };
  const first = commit(f, { message: 'Add CLI instruction', authorization,
    paths: [record('DR-aaaaaaaaaa', 'CLI 규칙을 지침으로 둔다'), '.gitifact/instructions/cli-rules/index.md', '.gitifact/instructions/cli-rules/references/decisions.md'] });
  assert.deepEqual(first.trailers, ['Gitifact-Doc: ' + I, 'Gitifact-Record: DR-aaaaaaaaaa']);
  assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, '');
  renameSync(join(f.repo, '.gitifact/instructions/cli-rules'), join(f.repo, '.gitifact/instructions/cli-layers'));
  commit(f, { message: 'Rename CLI instruction', authorization,
    paths: [record('DR-bbbbbbbbbb', '이름을 계층 중심으로'), '.gitifact/instructions/cli-rules/index.md', '.gitifact/instructions/cli-rules/references/decisions.md',
      '.gitifact/instructions/cli-layers/index.md', '.gitifact/instructions/cli-layers/references/decisions.md'] });
  assert.deepEqual(f.ok(['docs', 'history', I]).events.map(e => [e.types, e.path, e.records.map(r => r.title)]), [
    [['moved'], '.gitifact/instructions/cli-layers/index.md', ['이름을 계층 중심으로']],
    [['created'], '.gitifact/instructions/cli-rules/index.md', ['CLI 규칙을 지침으로 둔다']],
  ]);
  assert.ok(!existsSync(join(f.repo, '.gitifact/instructions/cli-rules')));
});
