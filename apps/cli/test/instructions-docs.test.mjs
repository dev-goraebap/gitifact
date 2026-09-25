import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectFixture } from './git-fixture.mjs';

const I = 'I-aaaaaaaaaa';
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const instruction = (id = I, body = '계층을 지킨다.') => `---\nid: ${id}\ntitle: CLI 규칙\ndescription: CLI 계층 규칙. apps/cli를 고칠 때 읽는다\n---\n\n${body}\n`;
const reference = (title, body) => `---\ntitle: ${title}\ndescription: 계층 결정. 계층을 바꿀 때 읽는다\n---\n\n${body}`;
const decisions = reference('결정 표', '| 결정 | 이유 |\n');
function put(f, path, content) {
  const file = join(f.repo, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
}
function commit(f, value) {
  const p = join(f.root, 'input.json'); writeFileSync(p, JSON.stringify(value));
  const result = f.run(['changes', 'commit', '--file', p, '--format', 'json']);
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}

test('instructions new writes the folder and index.md as a draft with an I- ID', t => {
  const f = projectFixture(t);
  const made = f.ok(['instructions', 'new', 'cli-rules', '--title', 'CLI 규칙', '--description', 'CLI 계층: apps/cli를 고칠 때 읽는다']);
  assert.match(made.id, /^I-[a-z2-7]{10}$/);
  assert.equal(made.path, '.gitifact/instructions/cli-rules/index.md');
  const text = readFileSync(join(f.repo, made.path), 'utf8');
  assert.match(text, /^---\nid: I-[a-z2-7]{10}\ntitle: CLI 규칙\ndescription: "CLI 계층: apps\/cli를 고칠 때 읽는다"\ndraft: true\n---\n\n/);
  assert.deepEqual(JSON.parse(f.run(['check', '--format', 'json']).stdout).problems.map(p => p.code), ['DOC_DRAFT']);
  assert.match(f.run(['instructions', 'new', 'Bad_Name', '--title', 'x', '--description', 'x']).stderr, /^INVALID_PATH: /);
  assert.match(f.run(['instructions', 'new', 'a/b', '--title', 'x', '--description', 'x']).stderr, /^INVALID_PATH: /);
  assert.match(f.run(['instructions', 'new', 'cli-rules', '--title', 'x', '--description', 'x']).stderr, /^DOCUMENT_EXISTS: /);
});

test('instructions are listed with AGENTS.md and their files by title, shown with their files, searched and checked', t => {
  const f = projectFixture(t);
  put(f, '.gitifact/instructions/cli-rules/index.md', instruction(I, '계층을 지킨다. [결정 표](references/decisions.md) · [없는 파일](references/missing.md)'));
  put(f, '.gitifact/instructions/cli-rules/references/decisions.md', decisions);
  put(f, '.gitifact/instructions/cli-rules/scripts/check.sh', 'echo ok\n');
  // init ran with --skip-agents, so there is no AGENTS.md yet: the list says so before the instructions.
  assert.equal(f.run(['instructions', 'list']).stdout, `AGENTS.md 없음 — 지침을 언제 읽을지 알리는 색인이 없습니다\n${I} CLI 규칙 (커밋 전: 추가) (cli-rules) — CLI 계층 규칙. apps/cli를 고칠 때 읽는다\n  references/decisions.md 결정 표 — 계층 결정. 계층을 바꿀 때 읽는다\n  scripts/check.sh\n`);
  writeFileSync(join(f.repo, 'AGENTS.md'), '# Agents\n');
  const listed = f.ok(['instructions', 'list']);
  assert.deepEqual([listed.contract, listed.agents, listed.problems], ['instructions', { path: 'AGENTS.md', exists: true }, []]);
  assert.deepEqual(listed.instructions, [{ id: I, name: 'cli-rules', path: '.gitifact/instructions/cli-rules/index.md', title: 'CLI 규칙', description: 'CLI 계층 규칙. apps/cli를 고칠 때 읽는다', state: 'added',
    files: [{ path: 'references/decisions.md', size: Buffer.byteLength(decisions), title: '결정 표', description: '계층 결정. 계층을 바꿀 때 읽는다' }, { path: 'scripts/check.sh', size: 8 }] }]);
  assert.match(f.run(['instructions', 'list']).stdout, /^AGENTS\.md — /);
  assert.equal(f.run(['instructions', 'list', '--fields', 'name,files']).stdout, 'cli-rules\treferences/decisions.md,scripts/check.sh\n');
  assert.deepEqual(f.ok(['specs', 'list']).documents, []);
  const shown = f.run(['instructions', 'show', I]).stdout;
  // A folder name reads the same instruction as its ID; --file reads one file of the folder.
  assert.equal(f.run(['instructions', 'show', 'cli-rules']).stdout, shown);
  assert.equal(f.run(['instructions', 'show', 'cli-rules', '--file', 'references/decisions.md']).stdout, `== ${I} cli-rules/references/decisions.md\n${decisions}`);
  assert.equal(f.ok(['instructions', 'show', I, '--file', 'scripts/check.sh']).file.text, 'echo ok\n');
  for (const [args, code] of [[['cli-rules', '--file', 'references/none.md'], 'UNKNOWN_FILE'], [['cli-rules', '--file', '../../spec/x.md'], 'UNKNOWN_FILE'],
    [['cli-rules', 'cli-rules', '--file', 'scripts/check.sh'], 'INVALID_VALUE'], [['no-such'], 'UNKNOWN_DOCUMENT']]) {
    const failed = f.run(['instructions', 'show', ...args, '--format', 'json']);
    assert.equal(failed.status, 1, args.join(' ')); assert.equal(JSON.parse(failed.stderr).error.code, code, args.join(' '));
  }
  assert.match(shown, /^== I-aaaaaaaaaa \.gitifact\/instructions\/cli-rules\/index\.md\n---\nid: I-aaaaaaaaaa\n/);
  assert.match(shown, /\n-- 파일\n  references\/decisions\.md 결정 표 — 계층 결정\. 계층을 바꿀 때 읽는다\n  scripts\/check\.sh\n$/);
  assert.deepEqual(f.ok(['instructions', 'list', '--q', '계층을']).instructions.map(i => [i.id, /계층을 지킨다/.test(i.line)]), [[I, true]]);
  // A link into the folder counts as found; a missing file is a warning.
  assert.deepEqual(f.ok(['check']).warnings.map(w => w.code + ' ' + w.message.split(': ').at(-1)), ['MISSING_LINK_TARGET references/missing.md']);

  // A design names the instruction it follows; the instruction never names a spec.
  put(f, '.gitifact/spec/posts/index.md', '---\nid: S-aaaaaaaaaa\ntitle: 게시물\ndescription: 게시물 기능\n---\n\n게시물.\n');
  put(f, '.gitifact/spec/posts/design/overview.md', `---\nid: D-aaaaaaaaaa\ntitle: 개요\ndescription: 저장 흐름\norder: 10\nsources:\n  - id: ${I}\n---\n\n저장한다.\n`);
  assert.match(f.run(['instructions', 'show', I]).stdout, /-- 가리키는 문서\n  D-aaaaaaaaaa 개요/);
  put(f, '.gitifact/instructions/cli-rules/references/rules.md', '[저장 설계](../../../spec/posts/design/overview.md)\n');
  put(f, '.gitifact/instructions/orphan/references/a.md', reference('a', 'a\n'));
  // A reference without its frontmatter is listed by path alone and the check says why.
  assert.deepEqual(f.ok(['instructions', 'list']).instructions[0].files.find(x => x.path === 'references/rules.md'), { path: 'references/rules.md', size: Buffer.byteLength('[저장 설계](../../../spec/posts/design/overview.md)\n') });
  const result = f.run(['check', '--format', 'json']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).problems.map(p => p.code + ' ' + p.path), [
    'INSTRUCTION_SPEC_LINK .gitifact/instructions/cli-rules/references/rules.md', 'FRONTMATTER_REQUIRED .gitifact/instructions/cli-rules/references/rules.md',
    'INSTRUCTION_INDEX_REQUIRED .gitifact/instructions/orphan/index.md',
  ]);
});

test('an instruction commits with its folder and reason, carries a Doc trailer, and keeps its history through a rename', t => {
  const f = projectFixture(t);
  put(f, '.gitifact/instructions/cli-rules/index.md', instruction());
  put(f, '.gitifact/instructions/cli-rules/references/decisions.md', decisions);
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
  assert.deepEqual(f.ok(['records', 'list', '--doc', I]).events.map(e => [e.types, e.path, e.records.map(r => r.title)]), [
    [['moved'], '.gitifact/instructions/cli-layers/index.md', ['이름을 계층 중심으로']],
    [['created'], '.gitifact/instructions/cli-rules/index.md', ['CLI 규칙을 지침으로 둔다']],
  ]);
  assert.ok(!existsSync(join(f.repo, '.gitifact/instructions/cli-rules')));
});
