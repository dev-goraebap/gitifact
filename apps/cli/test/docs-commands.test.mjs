import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDocumentFile, parseDocumentFile } from '@gitifact/core';
import { projectFixture, fingerprint } from './git-fixture.mjs';

const S = 'S-aaaaaaaaaa', R1 = 'R-bbbbbbbbbb', R2 = 'R-cccccccccc', D1 = 'D-dddddddddd', W = 'W-eeeeeeeeee';
const paths = { feature: '.gitifact/spec/payment/index.md', cancel: '.gitifact/spec/payment/requirements/cancel.md', list: '.gitifact/spec/payment/requirements/list.md',
  overview: '.gitifact/spec/payment/design/overview.md', wiki: '.gitifact/wiki/modules/payment.md' };
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };

function put(f, doc) {
  const file = join(f.repo, doc.path); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderDocumentFile(doc));
}
/** One feature with two requirements and an overview that names a requirement, a wiki page and an outside page. */
function payment(f) {
  put(f, { kind: 'feature', path: paths.feature, id: S, feature: 'payment', title: '결제', description: '결제 승인과 취소', body: '결제 기능의 범위.' });
  put(f, { kind: 'requirement', path: paths.cancel, id: R1, feature: 'payment', order: 10, title: '결제 취소', description: '승인된 결제를 취소한다', body: '구매자로서 결제를 취소하고 싶다. 취소는 승인 후 7일 안에만 된다.' });
  put(f, { kind: 'requirement', path: paths.list, id: R2, feature: 'payment', order: 20, title: '결제 목록', description: '기간으로 결제를 찾는다', body: '관리자로서 결제 목록을 보고 싶다.' });
  put(f, { kind: 'design', path: paths.overview, id: D1, feature: 'payment', order: 10, title: '개요', description: '취소 처리 흐름', body: '취소는 승인 기록을 찾아 PG사에 요청한다.',
    requirements: [R1], sources: [{ id: W }, { title: 'PG사 취소 API', url: 'https://example.test/cancel' }] });
  put(f, { kind: 'wiki', path: paths.wiki, id: W, title: '결제 모듈', description: '결제 모듈의 계층', body: '## 계층\n\n본문.' });
}

test('docs list shows frontmatter and referenced titles without bodies, narrowed by feature or kind', t => {
  const f = projectFixture(t); payment(f);
  const spec = f.run(['docs', 'list', '--kind', 'spec']);
  assert.equal(spec.status, 0, spec.stderr);
  assert.equal(spec.stdout, [
    `[기능] ${S} 결제 (payment) — 결제 승인과 취소`,
    '  요구사항',
    `    10 ${R1} 결제 취소 — 승인된 결제를 취소한다`,
    `    20 ${R2} 결제 목록 — 기간으로 결제를 찾는다`,
    '  설계',
    `    10 ${D1} 개요 — 취소 처리 흐름 [${R1} 결제 취소]`,
    `       참고: ${W} 결제 모듈, PG사 취소 API`,
    '',
  ].join('\n'));
  assert.doesNotMatch(spec.stdout, /7일/);
  const all = f.run(['docs', 'list']).stdout;
  // init wrote the wiki README; both pages are listed with their place in the wiki.
  assert.match(all, /^\[위키\]$/m); assert.match(all, new RegExp(`^  ${W} 결제 모듈 \\(modules/payment\\.md\\) — 결제 모듈의 계층$`, 'm'));
  assert.match(all, /^  W-[a-z2-7]{10} 위키 운영 방침 \(README\.md\) — /m);
  assert.doesNotMatch(f.run(['docs', 'list', '--kind', 'wiki']).stdout, /\[기능\]/);
  const json = f.ok(['docs', 'list', '--feature', 'payment']);
  assert.deepEqual([json.contract, json.version, json.ok, json.wiki, json.problems], ['docs', 1, true, [], []]);
  assert.deepEqual(json.features[0].designs[0].requirements, [{ id: R1, title: '결제 취소' }]);
  assert.deepEqual(json.features[0].designs[0].sources, [{ id: W, title: '결제 모듈' }, { title: 'PG사 취소 API', url: 'https://example.test/cancel' }]);
  const unknown = f.run(['docs', 'list', '--feature', 'nothing']);
  assert.equal(unknown.status, 1); assert.match(unknown.stderr, /^UNKNOWN_FEATURE: /);
  // A broken file is left out of the list and counted.
  writeFileSync(join(f.repo, paths.list), 'no frontmatter\n');
  assert.match(f.run(['docs', 'list', '--kind', 'spec']).stdout, /읽지 못한 문서 파일 1개/);
});

test('docs show prints the file as written with references both ways, and --ref reads a commit', t => {
  const f = projectFixture(t); payment(f); f.commit('Add payment');
  const shown = f.run(['docs', 'show', D1, R1]);
  assert.equal(shown.status, 0, shown.stderr);
  const [design, requirement] = shown.stdout.split(/\n\n(?=== )/);
  assert.equal(design, `== ${D1} ${paths.overview}\n${readFileSync(join(f.repo, paths.overview), 'utf8').trimEnd()}\n-- 참조\n  ${R1} 결제 취소\n  ${W} 결제 모듈\n  PG사 취소 API <https://example.test/cancel>`);
  assert.equal(requirement, `== ${R1} ${paths.cancel}\n${readFileSync(join(f.repo, paths.cancel), 'utf8').trimEnd()}\n-- 가리키는 문서\n  ${D1} 개요\n`);
  const edited = readFileSync(join(f.repo, paths.cancel), 'utf8').replace('7일', '14일');
  writeFileSync(join(f.repo, paths.cancel), edited);
  assert.equal(f.ok(['docs', 'show', R1]).documents[0].text, edited);
  const old = f.ok(['docs', 'show', R1, '--ref', 'HEAD']);
  assert.equal(old.commit, f.git(['rev-parse', 'HEAD']).stdout.trim());
  assert.match(old.documents[0].text, /7일/); assert.deepEqual(old.documents[0].referencedBy, [{ id: D1, title: '개요' }]);
  const missing = f.run(['docs', 'show', R1, 'R-zzzzzzzzzz', '--format', 'json']);
  assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stderr).error.code, 'UNKNOWN_DOCUMENT');
  assert.equal(f.run(['docs', 'show', R1, '--ref', 'no-such-ref']).status, 1);
});

test('docs search finds words inside Korean text with particles and shows the matching line', t => {
  const f = projectFixture(t); payment(f);
  const found = f.run(['docs', 'search', '승인']);
  assert.equal(found.status, 0, found.stderr);
  assert.match(found.stdout, new RegExp(`^${R1} 결제 취소 \\(spec/payment/requirements/cancel\\.md\\) — 승인된 결제를 취소한다\\n    .*승인 후 7일`, 'm'));
  assert.match(found.stdout, new RegExp(`^${D1} 개요 `, 'm'));
  assert.deepEqual(f.ok(['docs', 'search', '7일', '안에만']).hits.map(h => h.id), [R1]);
  assert.equal(f.run(['docs', 'search', '없는말']).stdout, '찾은 문서가 없습니다: 없는말\n');
});

test('docs new issues an ID and a draft skeleton that the check refuses until the draft line is gone', t => {
  const f = projectFixture(t);
  const feature = f.ok(['docs', 'new', 'feature', 'payment', '--title', '결제', '--description', '결제 승인과 취소']);
  assert.match(feature.id, /^S-[a-z2-7]{10}$/); assert.equal(feature.path, paths.feature);
  const first = f.ok(['docs', 'new', 'requirement', 'payment/cancel', '--title', '결제 취소', '--description', '승인된 결제를 취소한다']);
  const second = f.ok(['docs', 'new', 'requirement', 'payment/list', '--title', '결제 목록', '--description', '기간으로 찾는다']);
  assert.deepEqual([first.order, second.order], [10, 20]);
  const design = f.ok(['docs', 'new', 'design', 'payment/overview', '--title', '개요', '--description', '처리 흐름']);
  assert.match(design.id, /^D-/); assert.equal(design.order, 10);
  const page = f.run(['docs', 'new', 'wiki', 'rules/naming', '--title', '이름 규칙', '--description', '파일과 변수 이름']);
  assert.equal(page.status, 0, page.stderr); assert.match(page.stdout, /만들었습니다: \.gitifact\/wiki\/rules\/naming\.md \(W-[a-z2-7]{10}\)/);
  const text = readFileSync(join(f.repo, paths.cancel), 'utf8');
  assert.match(text, new RegExp(`^---\\nid: ${first.id}\\ntitle: 결제 취소\\ndescription: 승인된 결제를 취소한다\\norder: 10\\ndraft: true\\n---\\n\\n\\(사용자\\)로서`));
  assert.equal(parseDocumentFile(paths.cancel, text).draft, true);
  assert.match(f.run(['docs', 'list']).stdout, new RegExp(`10 ${first.id} 결제 취소 \\(초안\\) — `));

  const check = f.run(['docs', 'check']);
  assert.equal(check.status, 1); assert.match(check.stdout, /^문제 5개\n/);
  assert.equal((check.stdout.match(/DOC_DRAFT/g) ?? []).length, 5);
  const json = f.run(['docs', 'check', '--format', 'json']);
  assert.equal(json.status, 1); assert.equal(JSON.parse(json.stdout).ok, false);
  for (const path of [paths.feature, paths.cancel, paths.list, paths.overview, '.gitifact/wiki/rules/naming.md']) {
    const file = join(f.repo, path); writeFileSync(file, readFileSync(file, 'utf8').replace('draft: true\n', ''));
  }
  const clean = f.run(['docs', 'check']);
  assert.equal(clean.status, 0, clean.stdout); assert.equal(clean.stdout, '문제 없음 (문서 6개)\n');

  const before = fingerprint(join(f.repo, '.gitifact', 'spec'));
  for (const [kind, path, code] of [['requirement', 'payment', 'INVALID_PATH'], ['feature', 'Pay', 'INVALID_PATH'], ['design', 'payment/a/b', 'INVALID_PATH'],
    ['wiki', '../outside', 'INVALID_PATH'], ['requirement', 'payment/cancel', 'DOCUMENT_EXISTS']]) {
    const failed = f.run(['docs', 'new', kind, path, '--title', '제목', '--description', '설명', '--format', 'json']);
    assert.equal(failed.status, 1, kind + ' ' + path); assert.equal(JSON.parse(failed.stderr).error.code, code, kind + ' ' + path);
  }
  const multiline = f.run(['docs', 'new', 'requirement', 'payment/refund', '--title', '두\n줄', '--description', '설명']);
  assert.equal(multiline.status, 1); assert.match(multiline.stderr, /^INVALID_VALUE: .*title/);
  assert.notEqual(f.run(['docs', 'new', 'note', 'payment/x', '--title', 'a', '--description', 'b']).status, 0);
  assert.deepEqual(fingerprint(join(f.repo, '.gitifact', 'spec')), before);
  assert.equal(existsSync(join(f.repo, '.gitifact/wiki/outside.md')), false);
});

test('docs check reports every problem across files, including references broken by a deletion', t => {
  const f = projectFixture(t); payment(f);
  assert.equal(f.run(['docs', 'check']).status, 0);
  unlinkSync(join(f.repo, paths.wiki));
  writeFileSync(join(f.repo, '.gitifact/spec/payment/requirements.md'), '0.7 file\n');
  const result = f.run(['docs', 'check', '--format', 'json']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).problems.map(p => [p.code, p.path]).sort(), [
    ['MISSING_REFERENCE', paths.overview], ['PATH_UNSUPPORTED', '.gitifact/spec/payment/requirements.md'],
  ]);
});

test('docs check and changes list warn about broken links and assets without failing', t => {
  const f = projectFixture(t); payment(f);
  const cancel = parseDocumentFile(paths.cancel, readFileSync(join(f.repo, paths.cancel), 'utf8'));
  put(f, { ...cancel, body: cancel.body + '\n\n![흐름](../../../assets/flow.png) [없는 문서](../missing.md) [개발 안내](../../../../docs/guide.md) [외부](https://example.test/x)' });
  mkdirSync(join(f.repo, '.gitifact/assets'), { recursive: true }); mkdirSync(join(f.repo, 'docs'));
  writeFileSync(join(f.repo, '.gitifact/assets/flow.png'), 'png');
  writeFileSync(join(f.repo, '.gitifact/assets/dump.bin'), Buffer.alloc(1024 * 1024 + 1));
  writeFileSync(join(f.repo, 'docs/guide.md'), '# guide\n');
  const json = f.run(['docs', 'check', '--format', 'json']);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout).warnings.map(w => [w.code, w.path]), [
    ['MISSING_LINK_TARGET', paths.cancel], ['ASSET_SIZE', '.gitifact/assets/dump.bin'],
    ['ASSET_EXTENSION', '.gitifact/assets/dump.bin'], ['UNREFERENCED_ASSET', '.gitifact/assets/dump.bin'],
  ]);
  const shown = f.run(['docs', 'check']);
  assert.equal(shown.status, 0);
  assert.match(shown.stdout, /^경고 4개 \(커밋은 막지 않음\)\n  MISSING_LINK_TARGET 링크 대상이 없습니다: .*: \.\.\/missing\.md$/m);
  assert.match(f.run(['changes', 'list']).stdout, /^문서 경고: 4개 /m);
  assert.equal(f.ok(['changes', 'list']).warnings.length, 4);
});

test('docs history lists why and when a document changed, newest first', t => {
  const f = projectFixture(t); payment(f);
  const commit = (value, file) => { writeFileSync(file, JSON.stringify(value)); return f.run(['changes', 'commit', '--file', file]); };
  const input = join(f.root, 'input.json');
  const all = ['.gitifact/history.jsonl', paths.feature, paths.cancel, paths.list, paths.overview, paths.wiki];
  assert.equal(commit({ reasons: [{ docs: [R1, R2, D1], reason: '결제 취소 도입' }], paths: all, message: 'Add payment', authorization }, input).status, 0);
  writeFileSync(join(f.repo, paths.cancel), readFileSync(join(f.repo, paths.cancel), 'utf8').replace('7일', '14일'));
  assert.equal(commit({ reasons: [{ docs: [R1], reason: '취소 기간을 늘림' }], paths: ['.gitifact/history.jsonl', paths.cancel], message: 'Extend cancel window', authorization }, input).status, 0);
  const shown = f.run(['docs', 'history', R1]);
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, new RegExp(`^${R1} 결제 취소\\n\\n\\d{4}-\\d\\d-\\d\\d [a-f0-9]{7} modified — Fixture\\n  이유: 취소 기간을 늘림\\n  커밋: Extend cancel window\\n\\n\\d{4}-\\d\\d-\\d\\d [a-f0-9]{7} created — Fixture\\n  이유: 결제 취소 도입\\n  커밋: Add payment\\n$`));
  const json = f.ok(['docs', 'history', R2]);
  assert.deepEqual(json.events.map(e => [e.types, e.reasons]), [[['created'], ['결제 취소 도입']]]);
  assert.equal(f.run(['docs', 'history', 'R-zzzzzzzzzz']).status, 1);
});

test('docs commands refuse an uninitialized project and the 0.7 format with the migration guide', t => {
  const f = projectFixture(t);
  writeFileSync(join(f.repo, '.gitifact/config.json'), JSON.stringify({ schemaVersion: 2, baseline: { kind: 'empty' } }));
  const old = f.run(['docs', 'list']);
  assert.equal(old.status, 1); assert.match(old.stderr, /^UNSUPPORTED_SCHEMA: .*schemaVersion 2.*guide show migrate/);
  rmSync(join(f.repo, '.gitifact/config.json'));
  assert.equal(JSON.parse(f.run(['docs', 'check', '--format', 'json']).stderr).error.code, 'NOT_INITIALIZED');
});
