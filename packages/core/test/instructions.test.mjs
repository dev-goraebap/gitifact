import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocPath, parseDocumentFile, renderDocumentFile, checkDocuments, compareDocumentSets, arrangeDocuments, parseInstructionFile, isInstructionReference } from '../dist/index.js';

const I = 'I-aaaaaaaaaa';
const at = name => `.gitifact/instructions/${name}/index.md`;
const source = (id = I, body = '계층을 지킨다.') => `---\nid: ${id}\ntitle: CLI 규칙\ndescription: apps/cli를 고칠 때 읽는다\n---\n\n${body}\n`;

test('an index.md under .gitifact/instructions is an instruction; the other files of its folder belong to it', () => {
  assert.deepEqual(classifyDocPath(at('cli-rules')), { type: 'doc', kind: 'instruction', name: 'cli-rules' });
  assert.deepEqual(classifyDocPath('.gitifact/instructions/cli-rules/references/a.md'), { type: 'instruction-file', name: 'cli-rules' });
  assert.throws(() => classifyDocPath('.gitifact/instructions/README.md'), { code: 'PATH_UNSUPPORTED' });
  assert.throws(() => classifyDocPath('.gitifact/instructions/Bad/index.md'), { code: 'PATH_UNSUPPORTED' });
  const doc = parseDocumentFile(at('cli-rules'), source());
  assert.deepEqual(doc, { kind: 'instruction', name: 'cli-rules', id: I, path: at('cli-rules'), title: 'CLI 규칙', description: 'apps/cli를 고칠 때 읽는다', body: '계층을 지킨다.' });
  assert.deepEqual(parseDocumentFile(at('cli-rules'), renderDocumentFile({ ...doc, draft: true })), { ...doc, draft: true });
  // Instructions follow the same frontmatter and body rules as every other document.
  assert.throws(() => parseDocumentFile(at('a'), source('W-aaaaaaaaaa')), { code: 'ID_FORMAT' });
  assert.throws(() => parseDocumentFile(at('a'), source(I, '# 제목\n\n본문')), { code: 'BODY_HEADING' });
  assert.throws(() => parseDocumentFile(at('a'), source().replace('description:', 'order: 10\ndescription:')), { code: 'FRONTMATTER_UNKNOWN_KEY' });
});

const reference = (body = '본문') => `---\ntitle: 규칙 목록\ndescription: 코드를 고칠 때 읽는다\n---\n\n${body}\n`;

test('a reference file names itself with a title and a description and nothing else; its body is its own', () => {
  const path = '.gitifact/instructions/cli-rules/references/rules.md';
  assert.deepEqual(parseInstructionFile(path, reference('# 제목도 된다')), { title: '규칙 목록', description: '코드를 고칠 때 읽는다' });
  assert.deepEqual(parseInstructionFile(path, reference('').replace(/\n+$/, '\n')), { title: '규칙 목록', description: '코드를 고칠 때 읽는다' });
  assert.deepEqual(parseInstructionFile(path, reference().replace(/\n/g, '\r\n')).title, '규칙 목록');
  assert.throws(() => parseInstructionFile(path, '# 규칙\n\n본문'), { code: 'FRONTMATTER_REQUIRED' });
  assert.throws(() => parseInstructionFile(path, reference().replace('description: 코드를 고칠 때 읽는다\n', '')), { code: 'FRONTMATTER_MISSING_KEY' });
  // No ID, order or draft: the folder and the path say where it belongs.
  for (const key of ['id: I-aaaaaaaaaa', 'order: 10', 'draft: true']) {
    assert.throws(() => parseInstructionFile(path, reference().replace('title:', key + '\ntitle:')), { code: 'FRONTMATTER_UNKNOWN_KEY' });
  }
  assert.throws(() => parseInstructionFile(path, reference().replace('규칙 목록', 'x'.repeat(201))), { code: 'FRONTMATTER_VALUE' });
  assert.equal(isInstructionReference('references/a.md'), true);
  assert.equal(isInstructionReference('assets/logo.png'), false);
});

test('the check needs an index.md in every instruction folder and refuses links from instructions to specs', () => {
  const files = new Map([
    [at('a'), source(I, '[설계](../../spec/posts/design/overview.md) · [다른 지침](../b/index.md) · [상시](../../../AGENTS.md)\n\n```md\n[예시](../../spec/x/index.md)\n```')],
    ['.gitifact/instructions/a/references/rules.md', reference('[요구사항](../../../spec/posts/requirements/save.md) · [코드](../../../../apps/cli/src/main.ts)')],
    ['.gitifact/instructions/a/assets/logo.png', ''],
    ['.gitifact/instructions/orphan/references/r.md', reference()],
  ]);
  const result = checkDocuments(files);
  assert.deepEqual(result.problems.map(p => [p.code, p.path]), [
    ['INSTRUCTION_SPEC_LINK', '.gitifact/instructions/a/references/rules.md'],
    ['INSTRUCTION_SPEC_LINK', at('a')],
    ['INSTRUCTION_INDEX_REQUIRED', at('orphan')],
  ]);
  assert.deepEqual(arrangeDocuments(result.documents).instructions.map(d => d.name), ['a']);
});

test('the check reports a reference file without its frontmatter, and still its links; other files are not read', () => {
  const result = checkDocuments(new Map([
    [at('a'), source()],
    ['.gitifact/instructions/a/references/old.md', '# 옛 제목\n\n[설계](../../../spec/posts/design/overview.md)'],
    ['.gitifact/instructions/a/references/extra.md', reference().replace('title:', 'id: W-aaaaaaaaaa\ntitle:')],
    ['.gitifact/instructions/a/scripts/check.sh', ''],
  ]));
  assert.deepEqual(result.problems.map(p => [p.code, p.path]), [
    ['FRONTMATTER_UNKNOWN_KEY', '.gitifact/instructions/a/references/extra.md'],
    ['INSTRUCTION_SPEC_LINK', '.gitifact/instructions/a/references/old.md'],
    ['FRONTMATTER_REQUIRED', '.gitifact/instructions/a/references/old.md'],
  ]);
});

test('a renamed instruction folder is a move of the same instruction', () => {
  const moved = compareDocumentSets(new Map([[at('a'), source()]]), new Map([[at('b'), source()]]));
  assert.deepEqual(moved.changes.map(c => [c.id, c.kind, c.types, c.previousPath]), [[I, 'instruction', ['moved'], at('a')]]);
});
