import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDocumentFile, parseDocumentFile } from '@gitifact/core';
import { projectFixture, fingerprint } from './git-fixture.mjs';

const S = 'S-aaaaaaaaaa', R1 = 'R-bbbbbbbbbb', R2 = 'R-cccccccccc', D1 = 'D-dddddddddd', I = 'I-eeeeeeeeee';
const paths = { feature: '.gitifact/spec/payment/index.md', cancel: '.gitifact/spec/payment/requirements/cancel.md', list: '.gitifact/spec/payment/requirements/list.md',
  overview: '.gitifact/spec/payment/design/overview.md', instruction: '.gitifact/instructions/payment-modules/index.md' };
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };

function put(f, doc) {
  const file = join(f.repo, doc.path); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderDocumentFile(doc));
}
/** One feature with two requirements and an overview that names a requirement, an instruction and an outside page. */
function payment(f) {
  put(f, { kind: 'feature', path: paths.feature, id: S, feature: 'payment', title: '결제', description: '결제 승인과 취소', body: '결제 기능의 범위.' });
  put(f, { kind: 'requirement', path: paths.cancel, id: R1, feature: 'payment', order: 10, title: '결제 취소', description: '승인된 결제를 취소한다', body: '구매자로서 결제를 취소하고 싶다. 취소는 승인 후 7일 안에만 된다.' });
  put(f, { kind: 'requirement', path: paths.list, id: R2, feature: 'payment', order: 20, title: '결제 목록', description: '기간으로 결제를 찾는다', body: '관리자로서 결제 목록을 보고 싶다.' });
  put(f, { kind: 'design', path: paths.overview, id: D1, feature: 'payment', order: 10, title: '개요', description: '취소 처리 흐름', body: '취소는 승인 기록을 찾아 PG사에 요청한다.',
    requirements: [R1], sources: [{ id: I }, { title: 'PG사 취소 API', url: 'https://example.test/cancel' }] });
  put(f, { kind: 'instruction', path: paths.instruction, id: I, name: 'payment-modules', title: '결제 모듈', description: '결제 모듈의 계층', body: '## 계층\n\n본문.' });
}

test('specs list shows frontmatter and referenced titles without bodies, narrowed by feature or type', t => {
  const f = projectFixture(t); payment(f); f.commit('Add payment');
  const spec = f.run(['specs', 'list']);
  assert.equal(spec.status, 0, spec.stderr);
  assert.equal(spec.stdout, [
    `[기능] ${S} 결제 (payment) — 결제 승인과 취소`,
    '  요구사항',
    `    10 ${R1} 결제 취소 — 승인된 결제를 취소한다`,
    `    20 ${R2} 결제 목록 — 기간으로 결제를 찾는다`,
    '  설계',
    `    10 ${D1} 개요 — 취소 처리 흐름 [${R1} 결제 취소]`,
    `       참고: ${I} 결제 모듈, PG사 취소 API`,
    '',
  ].join('\n'));
  assert.doesNotMatch(spec.stdout, /7일|결제 모듈의 계층/);
  const json = f.ok(['specs', 'list', '--feature', 'payment']);
  assert.deepEqual([json.contract, json.version, json.ok, json.orphans, json.problems], ['specs', 1, true, [], []]);
  assert.deepEqual(json.documents.map(d => [d.kind, d.id]), [['feature', S], ['requirement', R1], ['requirement', R2], ['design', D1]]);
  assert.deepEqual(json.documents[3].requirements, [{ id: R1, title: '결제 취소' }]);
  assert.deepEqual(json.documents[3].sources, [{ id: I, title: '결제 모듈' }, { title: 'PG사 취소 API', url: 'https://example.test/cancel' }]);
  assert.deepEqual(json.documents[1].designs, [{ id: D1, title: '개요' }]);
  assert.equal('updated' in json.documents[0], false);
  // A filtered-out feature row still heads its rows, so each row is read with its feature.
  assert.equal(f.run(['specs', 'list', '--type', 'requirement']).stdout,
    `[기능] ${S} 결제 (payment) — 결제 승인과 취소\n  요구사항\n    10 ${R1} 결제 취소 — 승인된 결제를 취소한다\n    20 ${R2} 결제 목록 — 기간으로 결제를 찾는다\n`);
  const unknown = f.run(['specs', 'list', '--feature', 'nothing']);
  assert.equal(unknown.status, 1); assert.match(unknown.stderr, /^UNKNOWN_FEATURE: /);
  // A broken file is left out of the list and counted.
  writeFileSync(join(f.repo, paths.list), 'no frontmatter\n');
  assert.match(f.run(['specs', 'list']).stdout, /읽지 못한 문서 파일 1개/);
});

test('specs list says where each document stands against the last commit: a move by ID is one change, a deletion stays listed', t => {
  const f = projectFixture(t); payment(f); f.commit('Add payment');
  const R3 = 'R-hhhhhhhhhh';
  writeFileSync(join(f.repo, paths.cancel), readFileSync(join(f.repo, paths.cancel), 'utf8').replace('7일', '14일'));
  const moved = '.gitifact/spec/payment/requirements/search.md';
  writeFileSync(join(f.repo, moved), readFileSync(join(f.repo, paths.list))); unlinkSync(join(f.repo, paths.list));
  unlinkSync(join(f.repo, paths.overview));
  put(f, { kind: 'requirement', path: '.gitifact/spec/payment/requirements/refund.md', id: R3, feature: 'payment', order: 30, title: '부분 환불', description: '일부 금액만 돌려준다', body: '구매자로서 일부만 환불받고 싶다.' });
  const listed = f.ok(['specs', 'list']).documents;
  assert.deepEqual(listed.map(d => [d.id, d.state, d.previousPath ?? null]),
    [[S, 'committed', null], [R1, 'modified', null], [R2, 'modified', paths.list], [R3, 'added', null], [D1, 'deleted', null]]);
  assert.equal(listed.find(d => d.id === D1).path, paths.overview);
  const text = f.run(['specs', 'list']).stdout;
  assert.match(text, new RegExp(`10 ${R1} 결제 취소 — 승인된 결제를 취소한다 \\(커밋 전: 변경\\)`));
  assert.match(text, new RegExp(`30 ${R3} 부분 환불 — 일부 금액만 돌려준다 \\(커밋 전: 추가\\)`));
  assert.match(text, new RegExp(`10 ${D1} 개요 — 취소 처리 흐름 \\(커밋 전: 삭제 예정\\)`));
  assert.doesNotMatch(text, new RegExp(`\\[기능\\] ${S} 결제 \\(커밋`));
  // The same states come out of a subfolder, where Git's own paths would be relative to it.
  assert.deepEqual(f.ok(['specs', 'list'], { cwd: join(f.repo, '.gitifact') }).documents.map(d => d.state), ['committed', 'modified', 'modified', 'added', 'deleted']);
  f.commit('Settle payment');
  assert.deepEqual(f.ok(['specs', 'list']).documents.map(d => [d.id, d.state]), [[S, 'committed'], [R1, 'committed'], [R2, 'committed'], [R3, 'committed']]);
});

test('lists page by cursor: twenty by default, features whole, the next page after the cursor, a stale cursor refused', t => {
  const f = projectFixture(t); payment(f);
  put(f, { kind: 'feature', path: '.gitifact/spec/refund/index.md', id: 'S-ffffffffff', feature: 'refund', title: '환불', description: '환불 요청', body: '환불.' });
  for (let i = 0; i < 22; i++) put(f, { kind: 'requirement', path: `.gitifact/spec/refund/requirements/r${i}.md`, id: 'R-' + 'k'.repeat(8) + 'a' + 'abcdefghijklmnopqrstuv'[i], feature: 'refund', order: 10 + i, title: '요구사항 ' + i, description: '설명', body: '구매자로서 원한다.' });
  const first = f.ok(['specs', 'list', '--limit', '1']);
  assert.deepEqual([first.documents.map(d => d.feature).filter((v, i, a) => a.indexOf(v) === i), first.page], [['payment'], { total: 2, next: S, unit: 'feature' }]);
  assert.match(f.run(['specs', 'list', '--limit', '1']).stdout, new RegExp(`\\n기능 1/2개\\. 다음 페이지: 같은 명령에 --after ${S}\\n$`));
  const second = f.ok(['specs', 'list', '--limit', '1', '--after', S]);
  // A page of features carries all their documents, even past twenty.
  assert.deepEqual([second.documents.length, second.page.next], [23, null]);
  const flat = f.ok(['specs', 'list', '--sort', 'title']);
  assert.deepEqual([flat.documents.length, flat.page.total, flat.page.unit], [20, 27, 'document']);
  assert.equal(f.ok(['specs', 'list', '--sort', 'title', '--after', flat.page.next]).documents.length, 7);
  assert.equal(f.ok(['specs', 'list', '--sort', 'title', '--all']).documents.length, 27);
  // The line that says more follow stays off a tab-separated answer and goes to stderr.
  const fields = f.run(['specs', 'list', '--sort', 'title', '--fields', 'id']);
  assert.equal(fields.stdout.split('\n').filter(Boolean).length, 20); assert.match(fields.stderr, /항목 20\/27개/);
  const stale = f.run(['specs', 'list', '--after', 'S-zzzzzzzzzz', '--format', 'json']);
  assert.equal(stale.status, 1); assert.equal(JSON.parse(stale.stderr).error.code, 'INVALID_VALUE');
  assert.notEqual(f.run(['specs', 'list', '--all', '--limit', '3']).status, 0);
});

test('specs list picks rows by relation, state and history, sorts them and prints only the fields asked for', t => {
  const f = projectFixture(t); payment(f);
  put(f, { kind: 'feature', path: '.gitifact/spec/refund/index.md', id: 'S-ffffffffff', feature: 'refund', title: '환불', description: '환불 요청', body: '환불.' });
  put(f, { kind: 'requirement', path: '.gitifact/spec/refund/requirements/request.md', id: 'R-gggggggggg', feature: 'refund', order: 10, title: '환불 요청',
    description: '구매자가 환불을 요청한다', body: '구매자로서 환불을 요청하고 싶다.', draft: true });
  f.commit('Add payment and refund');
  const ids = args => f.ok(['specs', 'list', ...args]).documents.map(d => d.id);
  assert.deepEqual(ids(['--uncovered']), [R2, 'R-gggggggggg']);
  assert.deepEqual(ids(['--without-design']), ['S-ffffffffff', 'R-gggggggggg']);
  assert.deepEqual(ids(['--draft']), ['R-gggggggggg']);
  assert.deepEqual(ids(['--q', '7일']), [R1]);
  assert.match(f.run(['specs', 'list', '--q', '7일']).stdout, /^    10 R-bbbbbbbbbb 결제 취소 — 승인된 결제를 취소한다\n      .*승인 후 7일/m);
  assert.equal(f.run(['specs', 'list', '--q', '없는말']).stdout, '조건에 맞는 것이 없습니다.\n');
  // History: the fixture commits at one fixed date, so a later commit is told apart by the commit option.
  const base = f.git(['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(f.repo, paths.list), readFileSync(join(f.repo, paths.list), 'utf8').replace('보고 싶다', '찾고 싶다'));
  f.commit('Reword list');
  assert.deepEqual(ids(['--changed-since', base]), [R2]);
  assert.equal(ids(['--changed-since', '2026-09-13']).length, 6);
  assert.deepEqual(ids(['--changed-since', '2026-09-14']), []);
  assert.deepEqual(ids(['--author', 'fixture@example.invalid', '--type', 'feature']), [S, 'S-ffffffffff']);
  assert.deepEqual(ids(['--author', 'Someone else']), []);
  const updated = f.ok(['specs', 'list', '--sort', 'updated', '--limit', '1']).documents;
  assert.deepEqual([updated.length, updated[0].id, updated[0].updated.author], [1, R2, 'Tryce fixture']);
  assert.match(f.run(['specs', 'list', '--sort', 'title']).stdout, /^D-dddddddddd 개요 \(설계 · payment\) — 취소 처리 흐름\n/);
  assert.equal(f.run(['specs', 'list', '--type', 'requirement', '--fields', 'id,title,designs']).stdout,
    `${R1}\t결제 취소\t${D1}\n${R2}\t결제 목록\t\nR-gggggggggg\t환불 요청\t\n`);
  assert.deepEqual(f.ok(['specs', 'list', '--type', 'feature', '--fields', 'id,draft']).documents, [{ id: S, draft: null }, { id: 'S-ffffffffff', draft: null }]);
  for (const args of [['--fields', 'id,body'], ['--changed-since', 'no-such-ref']]) {
    const failed = f.run(['specs', 'list', ...args, '--format', 'json']);
    assert.equal(failed.status, 1, args.join(' ')); assert.equal(JSON.parse(failed.stderr).error.code, 'INVALID_VALUE');
  }
  assert.notEqual(f.run(['specs', 'list', '--limit', '0']).status, 0);
  assert.notEqual(f.run(['specs', 'list', '--sort', 'name']).status, 0);
});

test('specs show prints the file as written with references both ways, and --ref reads a commit', t => {
  const f = projectFixture(t); payment(f); f.commit('Add payment');
  const shown = f.run(['specs', 'show', D1, R1]);
  assert.equal(shown.status, 0, shown.stderr);
  const [design, requirement] = shown.stdout.split(/\n\n(?=== )/);
  assert.equal(design, `== ${D1} ${paths.overview}\n${readFileSync(join(f.repo, paths.overview), 'utf8').trimEnd()}\n-- 참조\n  ${R1} 결제 취소\n  ${I} 결제 모듈\n  PG사 취소 API <https://example.test/cancel>`);
  assert.equal(requirement, `== ${R1} ${paths.cancel}\n${readFileSync(join(f.repo, paths.cancel), 'utf8').trimEnd()}\n-- 가리키는 문서\n  ${D1} 개요\n`);
  const edited = readFileSync(join(f.repo, paths.cancel), 'utf8').replace('7일', '14일');
  writeFileSync(join(f.repo, paths.cancel), edited);
  assert.equal(f.ok(['specs', 'show', R1]).documents[0].text, edited);
  const old = f.ok(['specs', 'show', R1, '--ref', 'HEAD']);
  assert.equal(old.commit, f.git(['rev-parse', 'HEAD']).stdout.trim());
  assert.match(old.documents[0].text, /7일/); assert.deepEqual(old.documents[0].referencedBy, [{ id: D1, title: '개요' }]);
  const missing = f.run(['specs', 'show', R1, 'R-zzzzzzzzzz', '--format', 'json']);
  assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stderr).error.code, 'UNKNOWN_DOCUMENT');
  assert.equal(f.run(['specs', 'show', R1, '--ref', 'no-such-ref']).status, 1);
  // An instruction is read through its own resource, and the refusal says which.
  const instruction = f.run(['specs', 'show', I]);
  assert.equal(instruction.status, 1); assert.match(instruction.stderr, /^UNKNOWN_DOCUMENT: .*instructions show/);
  assert.match(f.run(['instructions', 'show', R1]).stderr, /^UNKNOWN_DOCUMENT: .*specs show/);
});

test('specs new and instructions new issue an ID and a draft skeleton that the check refuses until the draft line is gone', t => {
  const f = projectFixture(t);
  const feature = f.ok(['specs', 'new', 'feature', 'payment', '--title', '결제', '--description', '결제 승인과 취소']);
  assert.match(feature.id, /^S-[a-z2-7]{10}$/); assert.equal(feature.path, paths.feature);
  const first = f.ok(['specs', 'new', 'requirement', 'payment/cancel', '--title', '결제 취소', '--description', '승인된 결제를 취소한다']);
  const second = f.ok(['specs', 'new', 'requirement', 'payment/list', '--title', '결제 목록', '--description', '기간으로 찾는다']);
  assert.deepEqual([first.order, second.order], [10, 20]);
  const design = f.ok(['specs', 'new', 'design', 'payment/overview', '--title', '개요', '--description', '처리 흐름']);
  assert.match(design.id, /^D-/); assert.equal(design.order, 10);
  const rules = f.run(['instructions', 'new', 'naming', '--title', '이름 규칙', '--description', '파일과 변수 이름']);
  assert.equal(rules.status, 0, rules.stderr); assert.match(rules.stdout, /만들었습니다: \.gitifact\/instructions\/naming\/index\.md \(I-[a-z2-7]{10}\)/);
  const text = readFileSync(join(f.repo, paths.cancel), 'utf8');
  assert.match(text, new RegExp(`^---\\nid: ${first.id}\\ntitle: 결제 취소\\ndescription: 승인된 결제를 취소한다\\norder: 10\\ndraft: true\\n---\\n\\n\\(사용자\\)로서`));
  assert.equal(parseDocumentFile(paths.cancel, text).draft, true);
  assert.match(f.run(['specs', 'list']).stdout, new RegExp(`10 ${first.id} 결제 취소 \\(초안\\) — `));

  const check = f.run(['check']);
  assert.equal(check.status, 1); assert.match(check.stdout, /^문제 5개\n/);
  assert.equal((check.stdout.match(/DOC_DRAFT/g) ?? []).length, 5);
  const json = f.run(['check', '--format', 'json']);
  assert.equal(json.status, 1); assert.equal(JSON.parse(json.stdout).ok, false);
  for (const path of [paths.feature, paths.cancel, paths.list, paths.overview, '.gitifact/instructions/naming/index.md']) {
    const file = join(f.repo, path); writeFileSync(file, readFileSync(file, 'utf8').replace('draft: true\n', ''));
  }
  const clean = f.run(['check']);
  assert.equal(clean.status, 0, clean.stdout); assert.equal(clean.stdout, '문제 없음 (문서 5개)\n');

  const before = fingerprint(join(f.repo, '.gitifact', 'spec'));
  for (const [kind, path, code] of [['requirement', 'payment', 'INVALID_PATH'], ['feature', 'Pay', 'INVALID_PATH'], ['design', 'payment/a/b', 'INVALID_PATH'],
    ['instruction', 'rules/naming', 'INVALID_PATH'], ['requirement', 'payment/cancel', 'DOCUMENT_EXISTS']]) {
    const failed = f.run([...kind === 'instruction' ? ['instructions', 'new'] : ['specs', 'new', kind], path, '--title', '제목', '--description', '설명', '--format', 'json']);
    assert.equal(failed.status, 1, kind + ' ' + path); assert.equal(JSON.parse(failed.stderr).error.code, code, kind + ' ' + path);
  }
  const multiline = f.run(['specs', 'new', 'requirement', 'payment/refund', '--title', '두\n줄', '--description', '설명']);
  assert.equal(multiline.status, 1); assert.match(multiline.stderr, /^INVALID_VALUE: .*title/);
  // The wiki is gone as a kind to create; notes never were one.
  for (const kind of ['wiki', 'note']) assert.notEqual(f.run(['specs', 'new', kind, 'payment/x', '--title', 'a', '--description', 'b']).status, 0, kind);
  assert.deepEqual(fingerprint(join(f.repo, '.gitifact', 'spec')), before);
  assert.equal(existsSync(join(f.repo, '.gitifact/wiki')), false);
});

test('check reports every problem across files, including references broken by a deletion', t => {
  const f = projectFixture(t); payment(f);
  assert.equal(f.run(['check']).status, 0);
  rmSync(join(f.repo, dirname(paths.instruction)), { recursive: true });
  writeFileSync(join(f.repo, '.gitifact/spec/payment/requirements.md'), '0.7 file\n');
  // A page left from the wiki is refused and left out of every listing, even when it is a valid 0.8.0 page.
  const wiki = '.gitifact/wiki/modules/payment.md';
  put(f, { kind: 'wiki', path: wiki, id: 'W-wwwwwwwwww', title: '결제 모듈', description: '결제 모듈의 계층', body: '본문.' });
  const result = f.run(['check', '--format', 'json']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).problems.map(p => [p.code, p.path]).sort(), [
    ['MISSING_REFERENCE', paths.overview], ['PATH_UNSUPPORTED', '.gitifact/spec/payment/requirements.md'], ['WIKI_REMOVED', wiki],
  ]);
  assert.match(f.run(['check']).stdout, /WIKI_REMOVED .*guide show migrate/);
  const listed = f.ok(['specs', 'list']);
  assert.equal(listed.problems.filter(p => p.code === 'WIKI_REMOVED').length, 1);
  assert.equal(f.run(['specs', 'show', 'W-wwwwwwwwww']).status, 1);
  assert.deepEqual(f.ok(['instructions', 'list', '--q', '계층']).instructions, []);
});

test('check and changes list warn about broken links and assets without failing', t => {
  const f = projectFixture(t); payment(f);
  const cancel = parseDocumentFile(paths.cancel, readFileSync(join(f.repo, paths.cancel), 'utf8'));
  put(f, { ...cancel, body: cancel.body + '\n\n![흐름](../../../assets/flow.png) [없는 문서](../missing.md) [개발 안내](../../../../docs/guide.md) [외부](https://example.test/x)' });
  mkdirSync(join(f.repo, '.gitifact/assets'), { recursive: true }); mkdirSync(join(f.repo, 'docs'));
  writeFileSync(join(f.repo, '.gitifact/assets/flow.png'), 'png');
  writeFileSync(join(f.repo, '.gitifact/assets/dump.bin'), Buffer.alloc(1024 * 1024 + 1));
  writeFileSync(join(f.repo, 'docs/guide.md'), '# guide\n');
  const json = f.run(['check', '--format', 'json']);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout).warnings.map(w => [w.code, w.path]), [
    ['MISSING_LINK_TARGET', paths.cancel], ['ASSET_SIZE', '.gitifact/assets/dump.bin'],
    ['ASSET_EXTENSION', '.gitifact/assets/dump.bin'], ['UNREFERENCED_ASSET', '.gitifact/assets/dump.bin'],
  ]);
  const shown = f.run(['check']);
  assert.equal(shown.status, 0);
  assert.match(shown.stdout, /^경고 4개 \(커밋은 막지 않음\)\n  MISSING_LINK_TARGET 링크 대상이 없습니다: .*: \.\.\/missing\.md$/m);
  assert.match(f.run(['changes', 'list']).stdout, /^문서 경고: 4개 /m);
  assert.equal(f.ok(['changes', 'list']).warnings.length, 4);
});

test('records new writes a draft; records list --doc reads the records behind a document, newest first; records show prints one', t => {
  const f = projectFixture(t); payment(f);
  const commit = (value, file) => { writeFileSync(file, JSON.stringify(value)); return f.run(['changes', 'commit', '--file', file]); };
  const input = join(f.root, 'input.json');
  const made = f.ok(['records', 'new', '--title', '결제 취소 도입', '--docs', `${R1},${R2}`, D1]);
  assert.match(made.id, /^DR-[a-z2-7]{10}$/); const today = new Date(); const folder = String(today.getFullYear()) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  assert.equal(made.path, `.gitifact/records/${folder}/${made.id}.md`);
  const file = join(f.repo, made.path); const draft = readFileSync(file, 'utf8');
  // The required sections, headed in the CLI language, and the draft mark the check refuses until it goes.
  assert.equal(draft, `---\nid: ${made.id}\ntitle: 결제 취소 도입\ndocs:\n  - ${R1}\n  - ${R2}\n  - ${D1}\ndraft: true\n---\n\n## 맥락\n\n(내용)\n\n## 결정\n\n(내용)\n`);
  assert.deepEqual(JSON.parse(f.run(['check', '--format', 'json']).stdout).problems.map(p => p.code), ['DOC_DRAFT']);
  writeFileSync(file, draft.replace('draft: true\n', '').replace('## 맥락\n\n(내용)', '## 맥락\n\nPG사 정산 주기가 7일이다.')
    .replace('## 결정\n\n(내용)\n', '## 결정\n\n승인 후 7일 안에만 취소를 받는다.\n\n## 검토한 대안\n\n- 기간 없이 받기(정산 뒤 취소는 수작업)\n'));
  const all = [made.path, paths.feature, paths.cancel, paths.list, paths.overview, paths.instruction];
  assert.equal(commit({ paths: all, message: 'Add payment', authorization }, input).status, 0);
  writeFileSync(join(f.repo, paths.cancel), readFileSync(join(f.repo, paths.cancel), 'utf8').replace('7일', '14일'));
  const extend = f.ok(['records', 'new', '--title', '취소 기간 14일로 연장', '--docs', R1]);
  writeFileSync(join(f.repo, extend.path), readFileSync(join(f.repo, extend.path), 'utf8').replace('draft: true\n', '').replace('(내용)', '기간이 짧다는 문의가\n매주 들어온다.').replace('(내용)', '취소 기간을 14일로 늘린다.'));
  assert.equal(commit({ paths: [extend.path, paths.cancel], message: 'Extend cancel window', authorization }, input).status, 0);
  // records list: every record of HEAD, newest first, after the ones not committed yet.
  const pending = f.ok(['records', 'new', '--title', '목록 기간 필터', '--docs', R2]);
  const listed = f.ok(['records', 'list']).records;
  assert.deepEqual(listed.map(r => [r.id, r.commit === null, [...r.docs].sort()]), [[pending.id, true, [R2]], [extend.id, false, [R1]], [made.id, false, [R1, R2, D1].sort()]]);
  assert.match(f.run(['records', 'list']).stdout, new RegExp(`^${pending.id} 목록 기간 필터\\n  커밋 전 · ${R2}\\n${extend.id} 취소 기간 14일로 연장\\n  \\d{4}-\\d\\d-\\d\\d [a-f0-9]{7} Fixture · ${R1}\\n`));
  assert.deepEqual(f.ok(['records', 'list', '--q', '정산']).records.map(r => r.id), [made.id]);
  assert.deepEqual(f.ok(['records', 'list', '--author', 'fixture']).records.map(r => r.id), [extend.id, made.id]);
  assert.deepEqual(f.ok(['records', 'list', '--since', 'HEAD~1']).records.map(r => r.id), [pending.id, extend.id]);
  assert.equal(f.run(['records', 'list', '--fields', 'id,docs', '--limit', '1']).stdout, `${pending.id}\t${R2}\n`);
  // Pages run from the records not committed yet on into the committed ones, the cursor being the last ID shown.
  const page1 = f.ok(['records', 'list', '--limit', '2']);
  assert.deepEqual([page1.records.map(r => r.id), page1.page], [[pending.id, extend.id], { total: 3, next: extend.id, unit: 'record' }]);
  const page2 = f.ok(['records', 'list', '--limit', '2', '--after', page1.page.next]);
  assert.deepEqual([page2.records.map(r => r.id), page2.page.next], [[made.id], null]);
  assert.match(f.run(['records', 'list', '--limit', '2']).stdout, new RegExp(`결정기록 2/3개\\. 다음 페이지: 같은 명령에 --after ${extend.id}\\n$`));
  assert.equal(f.ok(['records', 'list', '--limit', '1', '--after', pending.id]).records[0].id, extend.id);
  assert.equal(JSON.parse(f.run(['records', 'list', '--after', 'DR-zzzzzzzzzz', '--format', 'json']).stderr).error.code, 'INVALID_VALUE');
  rmSync(join(f.repo, pending.path));
  const shown = f.run(['records', 'list', '--doc', R1]);
  assert.equal(shown.status, 0, shown.stderr);
  const day = '\\d{4}-\\d\\d-\\d\\d [a-f0-9]{7}';
  assert.match(shown.stdout, new RegExp(`^${R1} 결제 취소\\n\\n${day} modified — Fixture\\n  ${extend.id} 취소 기간 14일로 연장\\n    맥락: 기간이 짧다는 문의가 매주 들어온다\\.\\n    결정: 취소 기간을 14일로 늘린다\\.\\n  커밋: Extend cancel window\\n\\n`
    + `${day} created — Fixture\\n  ${made.id} 결제 취소 도입\\n    맥락: PG사 정산 주기가 7일이다\\.\\n    결정: 승인 후 7일 안에만 취소를 받는다\\.\\n    검토한 대안: - 기간 없이 받기\\(정산 뒤 취소는 수작업\\)\\n  커밋: Add payment\\n$`));
  const json = f.ok(['records', 'list', '--doc', R2]);
  assert.deepEqual(json.events.map(e => [e.types, e.records.map(r => [r.id, r.title, r.sections.map(s => s.key)])]), [[['created'], [[made.id, '결제 취소 도입', ['context', 'decision', 'alternatives']]]]]);
  // A change with no record says so; an added document without one does not.
  writeFileSync(join(f.repo, paths.list), readFileSync(join(f.repo, paths.list), 'utf8').replace('보고 싶다', '찾고 싶다'));
  assert.equal(commit({ paths: [paths.list], message: 'Reword list', authorization }, input).status, 0);
  assert.match(f.run(['records', 'list', '--doc', R2]).stdout, /modified — Fixture\n  결정기록 없음\n  커밋: Reword list\n/);
  assert.doesNotMatch(f.run(['records', 'list', '--doc', D1]).stdout, /결정기록 없음/);
  assert.equal(f.run(['records', 'list', '--doc', 'R-zzzzzzzzzz']).status, 1);
  // records show: the file as written and the commit that added it.
  const record = f.ok(['records', 'show', made.id]).records[0];
  assert.deepEqual([record.path, record.text, record.commit.author], [made.path, readFileSync(file, 'utf8'), 'Fixture']);
  assert.match(f.run(['records', 'show', made.id]).stdout, new RegExp(`^== ${made.id} ${made.path.replace(/\./g, '\\.')} \\([a-f0-9]{7} · Fixture · \\d{4}-\\d\\d-\\d\\d\\)\\n---\\n`));
  assert.equal(JSON.parse(f.run(['records', 'show', 'DR-zzzzzzzzzz', '--format', 'json']).stderr).error.code, 'UNKNOWN_RECORD');
  for (const args of [['--title', 'x', '--docs', 'X-aaaaaaaaaa'], ['--title', 'x'], ['--docs', R1], ['--title', '가'.repeat(81), '--docs', R1]]) {
    assert.notEqual(f.run(['records', 'new', ...args]).status, 0, args.join(' '));
  }
});

test('document commands refuse an uninitialized project and the 0.7 format with the migration guide', t => {
  const f = projectFixture(t);
  writeFileSync(join(f.repo, '.gitifact/config.json'), JSON.stringify({ schemaVersion: 2, baseline: { kind: 'empty' } }));
  const old = f.run(['specs', 'list']);
  assert.equal(old.status, 1); assert.match(old.stderr, /^UNSUPPORTED_SCHEMA: .*schemaVersion 2.*guide show migrate/);
  rmSync(join(f.repo, '.gitifact/config.json'));
  assert.equal(JSON.parse(f.run(['check', '--format', 'json']).stderr).error.code, 'NOT_INITIALIZED');
});
