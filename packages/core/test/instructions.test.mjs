import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocPath, parseDocumentFile, checkDocuments, compareDocumentSets, arrangeDocuments } from '../dist/index.js';

const I = 'I-aaaaaaaaaa';
const at = name => `.gitifact/instructions/${name}/index.md`;
const source = (id = I, body = '계층을 지킨다.') => `---\nid: ${id}\ntitle: CLI 규칙\ndescription: apps/cli를 고칠 때 읽는다\n---\n\n${body}\n`;

// Gitifact stopped keeping project instructions in 0.9.0. Commits before it still hold them, so the history reads them.
test('an instruction of a past commit still reads as a document of its folder', () => {
  assert.deepEqual(classifyDocPath(at('cli-rules')), { type: 'doc', kind: 'instruction', name: 'cli-rules' });
  assert.deepEqual(classifyDocPath('.gitifact/instructions/cli-rules/references/a.md'), { type: 'instruction-file', name: 'cli-rules' });
  assert.deepEqual(parseDocumentFile(at('cli-rules'), source()), { kind: 'instruction', name: 'cli-rules', id: I, path: at('cli-rules'), title: 'CLI 규칙', description: 'apps/cli를 고칠 때 읽는다', body: '계층을 지킨다.' });
  const moved = compareDocumentSets(new Map([[at('a'), source()]]), new Map([[at('b'), source()]]));
  assert.deepEqual(moved.changes.map(c => [c.id, c.kind, c.types, c.previousPath]), [[I, 'instruction', ['moved'], at('a')]]);
});

test('an instruction folder left in the tree is named once and not read; a design still naming it loses the source', () => {
  const design = `---\nid: D-dddddddddd\ntitle: 개요\ndescription: 흐름\norder: 10\nsources:\n  - id: ${I}\n---\n\n본문.\n`;
  const result = checkDocuments(new Map([
    [at('a'), source()], ['.gitifact/instructions/a/references/rules.md', '# 규칙'], ['.gitifact/instructions/a/assets/logo.png', ''],
    ['.gitifact/instructions/orphan/references/r.md', '본문'],
    ['.gitifact/spec/posts/index.md', '---\nid: S-aaaaaaaaaa\ntitle: 게시물\ndescription: 게시물\n---\n\n본문.\n'],
    ['.gitifact/spec/posts/design/overview.md', design],
  ]));
  assert.deepEqual(result.problems.map(p => [p.code, p.path]), [
    ['MISSING_REFERENCE', '.gitifact/spec/posts/design/overview.md'],
    ['INSTRUCTION_MOVED', '.gitifact/instructions/a'],
    ['INSTRUCTION_MOVED', '.gitifact/instructions/orphan'],
  ]);
  assert.ok(result.documents.every(d => d.kind !== 'instruction'));
  assert.deepEqual(Object.keys(arrangeDocuments(result.documents)), ['features', 'wiki', 'orphans']);
});
