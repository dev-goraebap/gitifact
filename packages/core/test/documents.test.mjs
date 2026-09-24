import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentFile, renderDocumentFile, parseReasonLines, renderReasonLine, classifyDocPath, checkDocuments, arrangeDocuments, compareDocumentSets } from '../dist/index.js';

const record = (id, docs, day = '20260924') => [`.gitifact/records/${day}/${id}.md`, `---\nid: ${id}\ntitle: 결제 취소 첫 정리\ndocs:\n${docs.map(d => '  - ' + d + '\n').join('')}---\n\n## 맥락\n\n결제 취소를 처음 정리했다.\n\n## 결정\n\n취소 요구사항을 둔다.\n`];

const S = 'S-aaaaaaaaaa', R1 = 'R-bbbbbbbbbb', R2 = 'R-cccccccccc', D1 = 'D-dddddddddd', D2 = 'D-eeeeeeeeee', W = 'W-ffffffffff', H = 'H-gggggggggg', DR = 'DR-gggggggggg', I = 'I-iiiiiiiiii';
const feature = `---\nid: ${S}\ntitle: 결제\ndescription: 결제 승인·취소·환불 흐름\n---\n\n결제 기능의 범위.\n`;
const requirement = (id = R1, order = 10, title = '결제 취소') => `---\nid: ${id}\ntitle: ${title}\ndescription: 승인된 결제를 전액 취소한다\norder: ${order}\n---\n\n구매자로서, 잘못 산 물건을 돌려받기 위해 결제를 취소하고 싶다.\n\n### 수용 조건\n\n1. 조건: 승인된 결제를 취소합니다.\n   기대 동작: 전액을 환불합니다.\n`;
const overview = `---\nid: ${D1}\ntitle: 개요\ndescription: 승인·취소 처리 흐름\norder: 10\nrequirements:\n  - ${R1}\nsources:\n  - id: ${I}\n    note: 모듈 경계\n  - title: PG사 취소 API\n    url: https://example.test/cancel\n---\n\n취소는 승인 기록을 찾아 PG사에 요청한다.\n`;
const wiki = `---\nid: ${W}\ntitle: 결제 모듈 아키텍처\ndescription: 결제 모듈의 계층과 의존 방향\n---\n\n## 계층\n\n본문.\n`;
const instruction = `---\nid: ${I}\ntitle: 결제 모듈 아키텍처\ndescription: 결제 모듈의 계층과 의존 방향. 결제 코드를 바꿀 때 읽는다.\n---\n\n## 계층\n\n본문.\n`;
const paths = {
  feature: '.gitifact/spec/payment/index.md', r1: '.gitifact/spec/payment/requirements/cancel.md', r2: '.gitifact/spec/payment/requirements/refund.md',
  overview: '.gitifact/spec/payment/design/overview.md', api: '.gitifact/spec/payment/design/api.md', wiki: '.gitifact/wiki/payment/architecture.md',
  instruction: '.gitifact/instructions/payment-architecture/index.md',
  reasons: '.gitifact/history.jsonl',
};

test('each kind parses from its folder and renders back to the same bytes', () => {
  const f = parseDocumentFile(paths.feature, feature);
  assert.deepEqual(f, { kind: 'feature', feature: 'payment', id: S, path: paths.feature, title: '결제', description: '결제 승인·취소·환불 흐름', body: '결제 기능의 범위.' });
  const r = parseDocumentFile(paths.r1, requirement());
  assert.deepEqual([r.kind, r.feature, r.order, r.title], ['requirement', 'payment', 10, '결제 취소']);
  assert.ok(r.body.startsWith('구매자로서,') && r.body.endsWith('전액을 환불합니다.'));
  const d = parseDocumentFile(paths.overview, overview);
  assert.deepEqual([d.kind, d.order, d.requirements, d.sources], ['design', 10, [R1], [{ id: I, note: '모듈 경계' }, { title: 'PG사 취소 API', url: 'https://example.test/cancel' }]]);
  const w = parseDocumentFile(paths.wiki, wiki);
  assert.deepEqual([w.kind, w.id, w.body], ['wiki', W, '## 계층\n\n본문.']);
  for (const [path, source] of [[paths.feature, feature], [paths.r1, requirement()], [paths.overview, overview], [paths.wiki, wiki]]) {
    assert.equal(renderDocumentFile(parseDocumentFile(path, source)), source);
  }
});

test('CRLF reads the same as LF, and values YAML would misread are quoted on render', () => {
  assert.deepEqual(parseDocumentFile(paths.r1, requirement().replaceAll('\n', '\r\n')), parseDocumentFile(paths.r1, requirement()));
  const doc = { ...parseDocumentFile(paths.r1, requirement()), title: '취소: 부분 환불', description: 'yes' };
  const text = renderDocumentFile(doc);
  assert.match(text, /\ntitle: "취소: 부분 환불"\ndescription: "yes"\n/);
  assert.deepEqual(parseDocumentFile(paths.r1, text), doc);
  // A design without references or sources leaves both keys out.
  const bare = renderDocumentFile({ ...parseDocumentFile(paths.overview, overview), requirements: [], sources: [] });
  assert.doesNotMatch(bare, /requirements:|sources:/);
});

test('paths decide the kind; other files in spec folders are refused and non-Markdown wiki files ignored', () => {
  assert.deepEqual(classifyDocPath(paths.r1), { type: 'doc', kind: 'requirement', feature: 'payment', slug: 'cancel' });
  assert.deepEqual(classifyDocPath(paths.reasons), { type: 'reasons' });
  // Per-folder reason files are the 0.7 layout: refused in a feature folder, and not a page in the wiki.
  assert.throws(() => classifyDocPath('.gitifact/spec/payment/history.jsonl'), { code: 'PATH_UNSUPPORTED' });
  assert.deepEqual(classifyDocPath('.gitifact/wiki/history.jsonl'), { type: 'ignored' });
  assert.deepEqual(classifyDocPath('.gitifact/wiki/README.md'), { type: 'doc', kind: 'wiki' });
  assert.deepEqual(classifyDocPath('.gitifact/wiki/diagrams/flow.png'), { type: 'ignored' });
  assert.deepEqual(classifyDocPath('.gitifact/assets/flow.png'), { type: 'ignored' });
  for (const path of ['.gitifact/spec/payment/requirements.md', '.gitifact/spec/payment/design.md', '.gitifact/spec/Pay/index.md',
    '.gitifact/spec/payment/requirements/Cancel.md', '.gitifact/spec/payment/requirements/a/b.md', '.gitifact/wiki/Guide/x.md']) {
    assert.throws(() => classifyDocPath(path), { code: 'PATH_UNSUPPORTED' }, path);
  }
});

test('malformed files fail with the code of their first problem', () => {
  const cases = [
    [paths.r1, requirement().replace(/^---\n/, ''), 'FRONTMATTER_REQUIRED'],
    [paths.r1, requirement().replace('\n---\n\n구매자', '\n\n구매자'), 'FRONTMATTER_UNCLOSED'],
    [paths.r1, requirement().replace('order: 10', 'order: 10\nstatus: done'), 'FRONTMATTER_UNKNOWN_KEY'],
    [paths.r1, requirement().replace(/description: .*\n/, ''), 'FRONTMATTER_MISSING_KEY'],
    [paths.r1, requirement(R1, '1.5'), 'FRONTMATTER_VALUE'],
    [paths.r1, requirement(R1, 10, '- 목록'), 'FRONTMATTER_VALUE'],
    [paths.r1, requirement(D1), 'ID_FORMAT'],
    [paths.r1, requirement().replace('구매자로서', '# 결제 취소\n\n구매자로서'), 'BODY_HEADING'],
    [paths.r1, requirement().replace('구매자로서', `<!-- gitifact-req: ${R1} -->\n구매자로서`), 'BODY_MARKER'],
    [paths.r1, requirement() + '```\n열린 코드\n', 'BODY_UNCLOSED_FENCE'],
    [paths.feature, feature.replace('결제 기능의 범위.', ''), 'BODY_REQUIRED'],
    [paths.feature, '﻿' + feature, 'INVALID_CHARACTERS'],
    [paths.overview, overview.replace('  - title: PG사 취소 API\n    url: https://example.test/cancel\n', '  - title: PG사 취소 API\n'), 'SOURCE_INVALID'],
    [paths.overview, overview.replace(`  - ${R1}`, `  - ${W}`), 'FRONTMATTER_VALUE'],
    [paths.overview, overview.replace(`requirements:\n  - ${R1}\n`, 'requirements:\n'), 'FRONTMATTER_LINE'],
  ];
  for (const [path, source, code] of cases) assert.throws(() => parseDocumentFile(path, source), { code }, code);
  // Headings and markers inside fenced code are examples, not structure.
  assert.doesNotThrow(() => parseDocumentFile(paths.r1, requirement().replace('구매자로서', `\`\`\`md\n# 예시\n<!-- gitifact-req: ${R2} -->\n\`\`\`\n\n구매자로서`)));
});

test('a draft mark is read as true only, renders last, and fails the whole-set check until removed', () => {
  const draft = requirement().replace('order: 10\n', 'order: 10\ndraft: true\n');
  const doc = parseDocumentFile(paths.r1, draft);
  assert.equal(doc.draft, true);
  assert.equal(renderDocumentFile(doc), draft);
  assert.equal(parseDocumentFile(paths.r1, requirement()).draft, undefined);
  for (const value of ['false', '"yes"', 'True']) {
    assert.throws(() => parseDocumentFile(paths.r1, draft.replace('draft: true', 'draft: ' + value)), { code: 'FRONTMATTER_VALUE' }, value);
  }
  const wikiDraft = parseDocumentFile(paths.wiki, wiki.replace('\n---\n\n## 계층', '\ndraft: true\n---\n\n## 계층'));
  assert.match(renderDocumentFile(wikiDraft), /\ndescription: .*\ndraft: true\n---\n/);
  const result = checkDocuments(new Map([[paths.feature, feature], [paths.r1, draft]]));
  assert.deepEqual(result.problems.map(p => [p.code, p.path]), [['DOC_DRAFT', paths.r1]]);
  assert.equal(result.documents.length, 2);
});

test('reason lines carry only id, docs and reason', () => {
  const line = { id: H, docs: [R1, D1], reason: '부분 환불 요청을 받아 취소 흐름을 나눴다.' };
  assert.equal(renderReasonLine(line), JSON.stringify(line));
  assert.deepEqual(parseReasonLines(paths.reasons, renderReasonLine(line) + '\n\n'), [line]);
  for (const bad of [{ ...line, date: 'x' }, { ...line, docs: [] }, { ...line, docs: [R1, R1] }, { ...line, docs: ['X-aaaaaaaaaa'] }, { ...line, id: R1 }, { ...line, reason: ' ' }]) {
    assert.throws(() => parseReasonLines(paths.reasons, JSON.stringify(bad)), { code: 'REASON_INVALID' });
  }
  assert.throws(() => parseReasonLines(paths.reasons, '{'), { code: 'REASON_INVALID' });
});

test('the whole-set check reports every problem and keeps checking the readable files', () => {
  const good = new Map([[paths.feature, feature], [paths.r1, requirement()], [paths.overview, overview], [paths.instruction, instruction],
    record(DR, [R1]), ['.gitifact/wiki/diagram.png', 'binary']]);
  const ok = checkDocuments(good);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.documents.map(d => d.id).sort(), [D1, I, R1, S].sort());
  assert.deepEqual(ok.records.map(r => [r.id, r.title, r.docs]), [[DR, '결제 취소 첫 정리', [R1]]]);

  const broken = new Map([
    // A second feature with a requirement and a design but neither index.md nor overview.md.
    ['.gitifact/spec/refund/requirements/request.md', requirement(R2, 10, '환불 요청')],
    ['.gitifact/spec/refund/design/api.md', overview.replace(D1, D2).replace(`  - ${R1}`, '  - R-zzzzzzzzzz')],
    // The payment feature: a duplicate ID, a duplicate order, a broken file and a source pointing at a deleted instruction.
    // A page left from the wiki is refused, not read; reasons may still name its W-.
    [paths.wiki, wiki], [paths.feature, feature], [paths.r1, requirement()], [paths.r2, requirement(R1, 10, '환불')],
    [paths.overview, overview], [paths.api, '# no frontmatter\n'],
    // The reason file records replaced, and one record ID used in two years' folders.
    [paths.reasons, renderReasonLine({ id: H, docs: [W], reason: 'a' }) + '\n'], record(DR, [W], '20250101'), record(DR, [R1]),
  ]);
  const result = checkDocuments(broken);
  const found = result.problems.map(p => [p.code, p.path]).sort();
  assert.deepEqual(found, [
    ['DESIGN_OVERVIEW_REQUIRED', '.gitifact/spec/refund/design/overview.md'],
    ['DUPLICATE_ID', paths.r2],
    ['DUPLICATE_ORDER', paths.r2],
    ['DUPLICATE_RECORD_ID', `.gitifact/records/20260924/${DR}.md`],
    ['FEATURE_INDEX_REQUIRED', '.gitifact/spec/refund/index.md'],
    ['FRONTMATTER_REQUIRED', paths.api],
    ['MISSING_REFERENCE', '.gitifact/spec/refund/design/api.md'],
    ['MISSING_REFERENCE', '.gitifact/spec/refund/design/api.md'],
    ['MISSING_REFERENCE', paths.overview],
    ['REASONS_FILE_REMOVED', paths.reasons],
    ['WIKI_REMOVED', paths.wiki],
  ].sort());
  assert.ok(result.problems.every(p => p.message.includes(p.path) || p.code.endsWith('_REQUIRED')));
  assert.equal(result.documents.length, 6);
});

test('arranged documents follow folder names, then order; a folder without index.md is an orphan', () => {
  const docs = [
    parseDocumentFile(paths.r2, requirement(R2, 5, '환불')), parseDocumentFile(paths.r1, requirement()),
    parseDocumentFile(paths.overview, overview), parseDocumentFile(paths.feature, feature), parseDocumentFile(paths.wiki, wiki),
    parseDocumentFile('.gitifact/spec/refund/requirements/request.md', requirement('R-zzzzzzzzzz', 10, '환불 요청')),
  ];
  const arranged = arrangeDocuments(docs);
  assert.deepEqual(arranged.features.map(f => [f.index.id, f.requirements.map(r => r.id), f.designs.map(d => d.id)]), [[S, [R2, R1], [D1]]]);
  assert.deepEqual(arranged.wiki.map(w => w.id), [W]);
  assert.deepEqual(arranged.orphans, ['refund']);
});

test('comparing two sets names created, modified, moved and deleted documents', () => {
  const before = new Map([[paths.feature, feature], [paths.r1, requirement()], [paths.wiki, wiki], record(DR, [R1])]);
  const after = new Map([
    // A CRLF checkout of the same text is no change; a broken file is not a change by ID; records are not documents.
    [paths.feature, feature.replaceAll('\n', '\r\n')], [paths.api, '# broken\n'],
    [paths.r2, requirement(R1, 10, '결제 취소 요청')], [paths.overview, overview], record('DR-hhhhhhhhhh', [R1, W]),
  ]);
  const { changes } = compareDocumentSets(before, after);
  assert.deepEqual(changes.map(c => [c.id, c.types, c.path, c.previousPath]), [
    [D1, ['created'], paths.overview, undefined],
    [R1, ['moved', 'modified'], paths.r2, paths.r1],
    [W, ['deleted'], paths.wiki, undefined],
  ]);
});
