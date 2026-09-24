import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordFile, renderRecordFile, classifyDocPath, isRecordPath, recordDayOf, recordPathOf, sectionKeyOf, RECORD_SECTION_LIMIT } from '../dist/index.js';

const H = 'DR-aaaaaaaaaa';
const path = `.gitifact/records/20260924/${H}.md`;
const front = (extra = '') => `---\nid: ${H}\ntitle: 삭제한 게시물의 30일 보관\ndocs:\n  - R-bbbbbbbbbb\n  - D-cccccccccc\n${extra}---\n\n`;
const record = front() + '## 맥락\n\n실수로 지운 글을 되살려 달라는 문의가 많다.\n\n## 결정\n\n지운 게시물은 30일 동안 휴지통에 둔다.\n';
const mixed = front() + '## Context\n\nIt reads in a diff.\n\n## 결정\n\nKeep one file per record.\n\n## Alternatives considered\n\n- jsonl (unreadable diff)\n- a table (grows without history)\n';

test('records live in day folders under their ID and are not documents', () => {
  assert.deepEqual(classifyDocPath(path), { type: 'record' });
  assert.equal(isRecordPath(path), true);
  assert.equal(recordPathOf(H, recordDayOf(new Date(2027, 0, 5))), `.gitifact/records/20270105/${H}.md`);
  for (const bad of ['.gitifact/records/DR-aaaaaaaaaa.md', '.gitifact/records/2026/DR-aaaaaaaaaa.md', '.gitifact/records/20261301/DR-aaaaaaaaaa.md', '.gitifact/records/20260924/notes.md', '.gitifact/records/20260924/H-aaaaaaaaaa.md', '.gitifact/records/2026/x/DR-aaaaaaaaaa.md']) {
    assert.throws(() => classifyDocPath(bad), { code: 'PATH_UNSUPPORTED' }, bad);
  }
});

test('a record reads its frontmatter and sections, in either language, and renders back to the same text', () => {
  const r = parseRecordFile(path, record);
  assert.deepEqual([r.id, r.title, r.docs], [H, '삭제한 게시물의 30일 보관', ['R-bbbbbbbbbb', 'D-cccccccccc']]);
  assert.deepEqual(r.sections.map(s => [s.key, s.body]), [['context', '실수로 지운 글을 되살려 달라는 문의가 많다.'], ['decision', '지운 게시물은 30일 동안 휴지통에 둔다.']]);
  assert.equal(renderRecordFile(r), record);
  const m = parseRecordFile(path, mixed);
  assert.deepEqual(m.sections.map(s => [s.key, s.heading]), [['context', 'Context'], ['decision', '결정'], ['alternatives', 'Alternatives considered']]);
  assert.equal(renderRecordFile(m), mixed);
  assert.equal(sectionKeyOf('alternatives CONSIDERED'), 'alternatives');
  // A draft is marked in frontmatter, and a heading inside fenced code is text.
  const draft = parseRecordFile(path, front('draft: true\n') + '## 맥락\n\n```md\n## 검토한 대안\n```\n\n## 결정\n\n본문\n');
  assert.equal(draft.draft, true); assert.deepEqual(draft.sections.map(s => s.key), ['context', 'decision']);
});

test('a record is refused for its first problem', () => {
  const cases = [
    [path.replace(H, 'DR-zzzzzzzzzz'), record, 'RECORD_PATH'],
    // Records have no type; the old key is an unknown one.
    [path, record.replace('title:', 'type: decision\ntitle:'), 'FRONTMATTER_UNKNOWN_KEY'],
    [path, record.replace('  - R-bbbbbbbbbb\n', '  - X-bbbbbbbbbb\n'), 'FRONTMATTER_VALUE'],
    [path, record.replace('  - D-cccccccccc\n', '  - R-bbbbbbbbbb\n'), 'FRONTMATTER_VALUE'],
    [path, record.replace('docs:\n  - R-bbbbbbbbbb\n  - D-cccccccccc\n', ''), 'FRONTMATTER_MISSING_KEY'],
    [path, record.replace('title:', 'order: 10\ntitle:'), 'FRONTMATTER_UNKNOWN_KEY'],
    [path, record.replace('삭제한 게시물의 30일 보관', '가'.repeat(81)), 'FRONTMATTER_VALUE'],
    // Sections: only the known ones, once each, nothing before the first, the required ones not empty, and short.
    [path, record.replace('## 결정', '## 이유'), 'RECORD_SECTION_UNKNOWN'],
    [path, record.replace('## 결정', '## 맥락'), 'RECORD_SECTION_UNKNOWN'],
    [path, front() + '서문\n\n## 맥락\n\n본문\n', 'RECORD_SECTION_UNKNOWN'],
    [path, front() + '## 맥락\n\n본문\n', 'RECORD_SECTION_MISSING'],
    [path, front() + '## 결정\n\n본문\n\n## 검토한 대안\n\n- 하나\n', 'RECORD_SECTION_MISSING'],
    [path, front() + '## 맥락\n\n\n## 결정\n\n본문\n', 'RECORD_SECTION_MISSING'],
    [path, record + '\n## 검토한 대안\n\n', 'RECORD_SECTION_MISSING'],
    [path, front() + '## 맥락\n\n' + '가'.repeat(RECORD_SECTION_LIMIT + 1) + '\n\n## 결정\n\n본문\n', 'RECORD_SECTION_TOO_LONG'],
    [path, front() + '# 제목\n\n## 맥락\n\n본문\n', 'BODY_HEADING'],
    [path, front() + '## 맥락\n\n```\n열린 채\n', 'BODY_UNCLOSED_FENCE'],
  ];
  for (const [where, source, code] of cases) assert.throws(() => parseRecordFile(where, source), { code }, code + ': ' + source.slice(-40));
  // The limit counts characters, not bytes: exactly the limit in a multi-byte script passes.
  assert.doesNotThrow(() => parseRecordFile(path, front() + '## 맥락\n\n' + '가'.repeat(RECORD_SECTION_LIMIT) + '\n\n## 결정\n\n본문\n'));
});
