import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocPath, parseDocumentFile, renderDocumentFile, checkDocuments, compareDocumentSets, arrangeDocuments } from '../dist/index.js';

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

test('the check needs an index.md in every instruction folder and refuses links from instructions to specs', () => {
  const files = new Map([
    [at('a'), source(I, '[설계](../../spec/posts/design/overview.md) · [다른 지침](../b/index.md) · [상시](../../../AGENTS.md)\n\n```md\n[예시](../../spec/x/index.md)\n```')],
    ['.gitifact/instructions/a/references/rules.md', '[요구사항](../../../spec/posts/requirements/save.md) · [코드](../../../../apps/cli/src/main.ts)'],
    ['.gitifact/instructions/a/assets/logo.png', ''],
    ['.gitifact/instructions/orphan/references/r.md', 'r'],
  ]);
  const result = checkDocuments(files);
  assert.deepEqual(result.problems.map(p => [p.code, p.path]), [
    ['INSTRUCTION_SPEC_LINK', '.gitifact/instructions/a/references/rules.md'],
    ['INSTRUCTION_SPEC_LINK', at('a')],
    ['INSTRUCTION_INDEX_REQUIRED', at('orphan')],
  ]);
  assert.deepEqual(arrangeDocuments(result.documents).instructions.map(d => d.name), ['a']);
});

test('a renamed instruction folder is a move of the same instruction', () => {
  const moved = compareDocumentSets(new Map([[at('a'), source()]]), new Map([[at('b'), source()]]));
  assert.deepEqual(moved.changes.map(c => [c.id, c.kind, c.types, c.previousPath]), [[I, 'instruction', ['moved'], at('a')]]);
});
