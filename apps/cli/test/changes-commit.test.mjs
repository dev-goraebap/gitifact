import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDocumentFile } from '@gitifact/core';
import { projectFixture, fingerprint } from './git-fixture.mjs';

const S = 'S-aaaaaaaaaa', R = 'R-bbbbbbbbbb', R2 = 'R-cccccccccc';
const H = 'DR-aaaaaaaaaa', H2 = 'DR-bbbbbbbbbb';
const docPaths = ['.gitifact/spec/posts/index.md', '.gitifact/spec/posts/requirements/save.md'];
const codePaths = ['app.js', 'app.test.js'];
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const locks = f => ['gitifact-changes-commit.lock', 'index.lock'].filter(l => existsSync(join(f.repo, '.git', l)));
const recordPath = id => `.gitifact/records/20260924/${id}.md`;

function put(f, doc) {
  const file = join(f.repo, doc.path); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderDocumentFile(doc));
}
/** A record file as `records new` leaves it once filled in; `draft` keeps the mark on. */
function record(f, id, docs, reason, { title = reason, draft = false } = {}) {
  const path = recordPath(id); const file = join(f.repo, path); mkdirSync(dirname(file), { recursive: true });
  const body = `## 맥락\n\n${reason}\n\n## 결정\n\n${title}\n`;
  writeFileSync(file, `---\nid: ${id}\ntitle: ${title}\ndocs:\n${docs.map(d => `  - ${d}\n`).join('')}${draft ? 'draft: true\n' : ''}---\n\n${body}`);
  return path;
}
function setup(t, format = 'sha1') {
  const f = projectFixture(t, format);
  put(f, { kind: 'feature', path: docPaths[0], id: S, feature: 'posts', title: '게시물', description: '게시물 작성과 조회', body: '게시물 기능.' });
  put(f, { kind: 'requirement', path: docPaths[1], id: R, feature: 'posts', order: 10, title: '저장', description: '제목을 입력해 저장한다', body: '작성자로서 게시물을 저장하고 싶다.' });
  f.write('app.js', 'export const save = title => !!title;\n'); f.write('app.test.js', '// fixture test source\n');
  const commit = (value, ...flags) => { const p = join(f.root, 'input.json'); writeFileSync(p, JSON.stringify(value)); return f.run(['changes', 'commit', '--file', p, '--format', 'json', ...flags]); };
  const ok = r => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  return { ...f, commit, done: r => ok(r) };
}
const request = (extra = {}) => ({ paths: [...docPaths, ...codePaths], message: 'Add post saving', authorization, ...extra });
/** The first commit of the fixture with one record that explains the requirement. */
const first = f => { const path = record(f, H, [R], '제목 없는 저장을 막기 위해 제목을 필수로 한다'); return request({ paths: [path, ...docPaths, ...codePaths] }); };

for (const format of ['sha1', 'sha256']) test(`dry-run previews without changes, then one command checks and commits the documents with their record (${format})`, t => {
  const f = setup(t, format); f.write('unrelated.txt', 'keep outside commit'); const input = first(f); const before = fingerprint(f.repo);
  const preview = f.done(f.commit(input, '--dry-run'));
  // New documents carry their own why; only a change to what was there needs a record.
  assert.deepEqual([preview.outcome, preview.committed, preview.withoutRecord], ['dry-run', false, []]);
  assert.deepEqual(preview.changes.map(c => [c.id, c.types]), [[R, ['created']], [S, ['created']]]);
  assert.deepEqual(preview.records, [{ id: H, title: '제목 없는 저장을 막기 위해 제목을 필수로 한다', docs: [R], path: recordPath(H) }]);
  assert.deepEqual(preview.trailers, ['Gitifact-Req: ' + R, 'Gitifact-Doc: ' + S, 'Gitifact-Record: ' + H]);
  assert.deepEqual(fingerprint(f.repo), before);
  const result = f.done(f.commit(input));
  assert.equal(result.outcome, 'committed'); assert.deepEqual(result.paths, [recordPath(H), ...docPaths, ...codePaths].sort());
  assert.equal(result.commit, f.git(['rev-parse', 'HEAD']).stdout.trim());
  assert.equal(f.git(['status', '--porcelain']).stdout, '?? unrelated.txt\n');
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, new RegExp(`^Add post saving\\n\\nGitifact-Req: ${R}\\nGitifact-Doc: ${S}\\nGitifact-Record: ${H}\\n`));
  // The record is committed as written; no reason file is kept any more.
  assert.equal(f.git(['show', 'HEAD:' + recordPath(H)]).stdout, readFileSync(join(f.repo, recordPath(H)), 'utf8'));
  assert.equal(existsSync(join(f.repo, '.gitifact/history.jsonl')), false);
  assert.deepEqual(locks(f), []);
  // Nothing left to commit: the selection stages nothing new.
  const head = f.git(['rev-parse', 'HEAD']).stdout;
  assert.equal(f.commit({ paths: codePaths, message: 'Again', authorization }).status, 1); assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head);
});

test('changes list names changed documents, uncommitted records, changes without one, shared documents, and the input path', t => {
  const f = setup(t);
  const text = f.run(['changes', 'list']);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, new RegExp(`^HEAD 대비 바뀐 문서 2개\\n  created   ${R} 저장 — ${docPaths[1]}\\n  created   ${S} 게시물 — ${docPaths[0]}\\n문서 검사: 문제 없음\\n커밋 입력 파일: .*commit\\.json\\n$`));
  f.done(f.commit(first(f)));
  assert.equal(f.run(['changes', 'list']).stdout.split('\n')[0], 'HEAD 대비 바뀐 문서가 없습니다.');
  // A moved and edited requirement is one change of that document, and it needs a record.
  const moved = '.gitifact/spec/posts/requirements/store.md';
  writeFileSync(join(f.repo, moved), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '보관하고 싶다')); unlinkSync(join(f.repo, docPaths[1]));
  const listed = f.ok(['changes', 'list']);
  assert.deepEqual(listed.changes, [{ id: R, kind: 'requirement', types: ['moved', 'modified'], title: '저장', path: moved, previousPath: docPaths[1] }]);
  assert.deepEqual([listed.withoutRecord, listed.pendingRecords], [[R], []]);
  // A draft record written for it is pending; the draft is a problem until it is filled in.
  record(f, H2, [R, S], '보관이라는 말로 바꿈', { draft: true });
  const drafted = f.ok(['changes', 'list']);
  assert.deepEqual([drafted.withoutRecord, drafted.pendingRecords.map(r => [r.id, r.draft]), drafted.problems.map(p => p.code)], [[], [[H2, true]], ['DOC_DRAFT']]);
  // S is named but did not change here, which the text marks with a star.
  assert.match(f.run(['changes', 'list']).stdout, new RegExp(`커밋하지 않은 결정기록 1개 .*\\n  ${H2} 보관이라는 말로 바꿈 \\(초안\\) — ${R}, ${S}\\*\\n`));
  // Two records explaining one changed document go into one commit.
  record(f, 'DR-cccccccccc', [R], '이름도 정리함');
  assert.deepEqual(f.ok(['changes', 'list']).sharedDocuments, [R]);
  assert.match(f.run(['changes', 'list']).stdout, new RegExp(`두 기록이 함께 설명하는 문서: ${R}\\.`));
});

test('a failing document check stops the commit before anything is written', t => {
  const f = setup(t);
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('order: 10\n', 'order: 10\ndraft: true\n'));
  // changes list shows the problem before a commit is tried.
  assert.match(f.run(['changes', 'list']).stdout, /\n문서 검사: 문제 1개 \(check로 확인\)\n/);
  assert.deepEqual(f.ok(['changes', 'list']).problems.map(p => p.code), ['DOC_DRAFT']);
  const input = first(f); const before = fingerprint(f.repo);
  const result = f.commit(input);
  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr).error;
  assert.equal(error.code, 'DOCS_CHECK_FAILED'); assert.deepEqual(error.problems.map(p => p.code), ['DOC_DRAFT']);
  assert.deepEqual(fingerprint(f.repo), before); assert.deepEqual(locks(f), []);
  const text = f.run(['changes', 'commit', '--file', join(f.root, 'input.json')]);
  assert.match(text.stderr, /^DOCS_CHECK_FAILED: .*\n  DOC_DRAFT /);
});

test('a selected record is checked; records left for a later commit may still be drafts', t => {
  const f = setup(t); f.done(f.commit(first(f)));
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '임시 저장도 하고 싶다'));
  const draft = record(f, H2, [R], '임시 저장', { draft: true });
  const later = record(f, 'DR-cccccccccc', [S], '아직 쓰는 중', { draft: true });
  const refused = f.commit({ paths: [draft, docPaths[1]], message: 'Drafts', authorization });
  assert.deepEqual(JSON.parse(refused.stderr).error.problems.map(p => [p.code, p.path]), [['DOC_DRAFT', draft]]);
  // A section too long is refused the same way, by the same check as docs check.
  record(f, H2, [R], '가'.repeat(501), { title: '임시 저장' });
  assert.deepEqual(JSON.parse(f.commit({ paths: [draft, docPaths[1]], message: 'Drafts', authorization }).stderr).error.problems.map(p => p.code), ['RECORD_SECTION_TOO_LONG']);
  record(f, H2, [R], '임시 저장도 해 두려는 요청이 많다');
  const result = f.done(f.commit({ paths: [draft, docPaths[1]], message: 'Drafts', authorization }));
  assert.deepEqual([result.records.map(r => r.id), result.withoutRecord], [[H2], []]);
  // The unselected draft stays for the next commit.
  assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, `?? ${later}\n`);
});

test('changes without a record are reported without blocking, and code-only commits carry no trailers', t => {
  const f = setup(t); f.done(f.commit(request()));
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '보관하고 싶다'));
  const result = f.done(f.commit({ paths: [docPaths[1]], message: 'Reword', authorization }));
  assert.deepEqual([result.withoutRecord, result.records], [[R], []]);
  f.write('app.js', 'export const save = title => !!title.trim();\n');
  const code = f.done(f.commit({ paths: ['app.js'], message: 'Trim titles', authorization }));
  assert.deepEqual([code.paths, code.trailers], [['app.js'], []]); assert.equal(f.git(['log', '-1', '--format=%B']).stdout.trim(), 'Trim titles');
  // A record may explain code that implements an unchanged requirement; the requirement is named in a trailer.
  f.write('app.js', 'export const save = title => title.trim().length > 0;\n');
  const path = record(f, H, [R], '공백만 있는 제목도 막음');
  const explained = f.done(f.commit({ paths: [path, 'app.js'], message: 'Reject blank titles', authorization }));
  assert.deepEqual([explained.changes, explained.trailers], [[], ['Gitifact-Req: ' + R, 'Gitifact-Record: ' + H]]);
});

test('unknown documents, the old reasons input and a message with trailers are rejected without changes', t => {
  const f = setup(t); const unknown = record(f, H, ['R-zzzzzzzzzz'], 'unknown'); const before = fingerprint(f.repo);
  for (const [extra, code] of [
    [{ paths: [unknown, ...docPaths] }, 'INVALID_COMMIT'],
    [{ reasons: [{ docs: [R], reason: 'old shape' }] }, 'INVALID_COMMIT'],
    [{ expected: 'stamp' }, 'INVALID_COMMIT'],
    [{ migration: 'yes' }, 'INVALID_COMMIT'],
    [{ message: 'Add\n\nGitifact-Req: ' + R }, 'INVALID_COMMIT'],
  ]) {
    const result = f.commit(request(extra));
    assert.equal(result.status, 1, JSON.stringify(extra)); assert.equal(JSON.parse(result.stderr).error.code, code);
    assert.deepEqual(fingerprint(f.repo), before);
  }
  const bad = join(f.root, 'bad.json'); writeFileSync(bad, 'not json');
  assert.equal(JSON.parse(f.run(['changes', 'commit', '--file', bad, '--format', 'json']).stderr).error.code, 'INVALID_INPUT');
});

test('a committed record cannot be edited or deleted; changes list and check name it before the commit is refused', t => {
  const f = setup(t); f.done(f.commit(first(f)));
  const file = join(f.repo, recordPath(H)); const committed = readFileSync(file, 'utf8');
  f.write('app.js', 'export const save = title => title.length > 0;\n');
  const next = { paths: ['app.js'], message: 'Check the length', authorization };
  for (const edit of [() => writeFileSync(file, committed.replace('제목을 필수로', '다른 이유로')), () => unlinkSync(file)]) {
    edit();
    assert.deepEqual(f.ok(['changes', 'list']).alteredRecords, [recordPath(H)]);
    assert.match(f.run(['changes', 'list']).stdout, new RegExp(`\\n커밋된 결정기록이 바뀌거나 지워짐\\(커밋이 거부됨\\): ${recordPath(H)}\\n`));
    assert.deepEqual(JSON.parse(f.run(['check', '--format', 'json']).stdout).problems.map(p => p.code), ['RECORD_ALTERED']);
    const before = fingerprint(f.repo); const head = f.git(['rev-parse', 'HEAD']).stdout;
    const refused = f.commit(next);
    assert.equal(refused.status, 1); const { error } = JSON.parse(refused.stderr);
    assert.equal(error.code, 'INVALID_COMMIT'); assert.match(error.message, new RegExp(H));
    assert.deepEqual(fingerprint(f.repo), before); assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head); assert.deepEqual(locks(f), []);
  }
  // Restored to HEAD, a changed decision is a new record.
  writeFileSync(file, committed);
  const changed = record(f, H2, [R], '길이로 빈 제목을 막음');
  assert.deepEqual(f.done(f.commit({ ...next, paths: [changed, 'app.js'] })).records.map(r => r.id), [H2]);
});

test('a selection may leave changes for later, but a moved document goes whole; files outside the store rules and staging are refused', t => {
  const f = setup(t);
  // The feature alone: the requirement stays for another commit.
  const part = f.done(f.commit({ paths: [docPaths[0]], message: 'Feature first', authorization }));
  assert.deepEqual(part.changes.map(c => c.id), [S]);
  assert.deepEqual(f.ok(['changes', 'list']).changes.map(c => c.id), [R]);
  f.done(f.commit({ paths: [docPaths[1], ...codePaths], message: 'Requirement', authorization }));
  const moved = '.gitifact/spec/posts/requirements/store.md';
  writeFileSync(join(f.repo, moved), readFileSync(join(f.repo, docPaths[1]), 'utf8')); unlinkSync(join(f.repo, docPaths[1]));
  let before = fingerprint(f.repo);
  for (const paths of [[moved], [docPaths[1]]]) {
    const half = f.commit({ paths, message: 'Half a move', authorization });
    assert.equal(JSON.parse(half.stderr).error.code, 'INVALID_COMMIT', paths.join()); assert.match(JSON.parse(half.stderr).error.message, new RegExp(R));
    assert.deepEqual(fingerprint(f.repo), before);
  }
  f.done(f.commit({ paths: [moved, docPaths[1]], message: 'Move', authorization }));
  f.write('.gitifact/scratch.txt', 'x'); f.write('app.js', 'export const save = () => true;\n');
  const outside = f.commit({ paths: ['app.js', '.gitifact/scratch.txt'], message: 'x', authorization });
  assert.equal(outside.status, 1); assert.match(JSON.parse(outside.stderr).error.message, /scratch\.txt/);
  unlinkSync(join(f.repo, '.gitifact/scratch.txt'));
  f.git(['add', 'app.js']); before = fingerprint(f.repo); assert.equal(f.commit({ paths: ['app.js'], message: 'x', authorization }).status, 1); assert.deepEqual(fingerprint(f.repo), before);
  const g = setup(t); g.git(['add', '-N', 'app.js']); before = fingerprint(g.repo); assert.equal(g.commit(request()).status, 1); assert.deepEqual(fingerprint(g.repo), before);
});

test('assets travel with the documents they illustrate', t => {
  const f = setup(t); mkdirSync(join(f.repo, '.gitifact/assets')); f.write('.gitifact/assets/logo.svg', '<svg/>');
  const result = f.done(f.commit(request({ paths: [...request().paths, '.gitifact/assets/logo.svg'] })));
  assert.ok(result.paths.includes('.gitifact/assets/logo.svg'));
});

test('a rejected commit leaves the record and the index as they were, then retries cleanly', t => {
  const f = setup(t); f.done(f.commit(first(f)));
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '임시 저장도 하고 싶다'));
  const hook = join(f.repo, '.git/hooks/pre-commit'); writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  const path = record(f, H2, [R], '임시 저장'); const text = readFileSync(join(f.repo, path));
  const head = f.git(['rev-parse', 'HEAD']).stdout; const index = readFileSync(join(f.repo, '.git/index'));
  const input = { paths: [path, docPaths[1]], message: 'Drafts', authorization };
  assert.equal(f.commit(input).status, 1);
  assert.deepEqual(readFileSync(join(f.repo, path)), text); assert.deepEqual(readFileSync(join(f.repo, '.git/index')), index);
  assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head); assert.deepEqual(locks(f), []);
  unlinkSync(hook); f.done(f.commit(input)); assert.equal(f.git(['rev-list', '--count', 'HEAD']).stdout.trim(), '3');
});

test('a CRLF checkout of untouched documents commits without rewriting them (core.autocrlf)', t => {
  const f = setup(t);
  put(f, { kind: 'requirement', path: '.gitifact/spec/posts/requirements/list.md', id: R2, feature: 'posts', order: 20, title: '목록', description: '게시물 목록', body: '목록을 본다.' });
  const all = [...docPaths, '.gitifact/spec/posts/requirements/list.md'];
  f.done(f.commit(request({ paths: [...all, ...codePaths] })));
  // Check the documents out again as Windows does: LF blobs become CRLF files while Git reports them unchanged.
  // The fixture's own Git calls pin core.autocrlf=false; these override it as the project setting does for the CLI.
  f.git(['config', 'core.autocrlf', 'true']);
  const crlf = args => f.git(['-c', 'core.autocrlf=true', ...args]);
  for (const p of all) unlinkSync(join(f.repo, p));
  crlf(['checkout', '--', ...all]);
  for (const p of all) assert.match(readFileSync(join(f.repo, p), 'utf8'), /\r\n/);
  assert.equal(crlf(['status', '--porcelain']).stdout, '');
  const untouched = readFileSync(join(f.repo, all[2]));
  assert.deepEqual(f.ok(['changes', 'list']).changes, []);
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '본문과 함께 저장하고 싶다'));
  f.write('app.js', 'export const save = (title, body) => !!title && !!body;\n');
  // A record written with CRLF line endings, as an editor on Windows saves it.
  const path = record(f, H, [R], '본문도 필수로 처리'); writeFileSync(join(f.repo, path), readFileSync(join(f.repo, path), 'utf8').replace(/\n/g, '\r\n'));
  const input = { paths: [path, docPaths[1], 'app.js'], message: 'Require body', authorization };
  assert.deepEqual(f.done(f.commit(input, '--dry-run')).changes.map(c => [c.id, c.types]), [[R, ['modified']]]);
  assert.deepEqual(f.done(f.commit(input)).paths, [path, docPaths[1], 'app.js'].sort());
  assert.deepEqual(readFileSync(join(f.repo, all[2])), untouched); assert.equal(crlf(['status', '--porcelain']).stdout, '');
  assert.doesNotMatch(f.git(['show', 'HEAD:' + path]).stdout, /\r/);
});

test('a Git clean filter that rewrites document content is still rejected and rolled back', t => {
  const f = setup(t); f.git(['config', 'filter.upper.clean', 'tr a-z A-Z']); f.git(['config', 'filter.upper.smudge', 'cat']);
  f.write('.gitattributes', '.gitifact/spec/** filter=upper\n'); const head = f.git(['rev-parse', 'HEAD']).stdout;
  const result = f.commit(request()); assert.equal(result.status, 1); assert.match(JSON.parse(result.stderr).error.message, /Git 필터/);
  assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head); assert.deepEqual(locks(f), []);
});

test('a hook changing the commit keeps recovery evidence and blocks retries', t => {
  const f = setup(t); writeFileSync(join(f.repo, '.git/hooks/pre-commit'), '#!/bin/sh\nprintf extra > extra.txt\ngit add extra.txt\n');
  const input = first(f);
  const result = f.commit(input); assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr).error.code, 'COMMIT_UNCERTAIN');
  assert.equal(existsSync(join(f.repo, '.git/gitifact-changes-commit.lock/recovery.json')), true);
  const head = f.git(['rev-parse', 'HEAD']).stdout; assert.equal(f.commit(input).status, 1); assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head);
});

test('a migration commit removes the 0.7 files, moves the wiki and the reasons to instructions and records, and stays out of the history', t => {
  const f = setup(t);
  // The 0.7 layout at HEAD: one requirements.md per feature and a reason file in its folder.
  for (const p of docPaths) unlinkSync(join(f.repo, p));
  f.write('.gitifact/spec/posts/requirements.md', '---\nid: S-aaaaaaaaaa\n---\n\n# 게시물\n');
  f.write('.gitifact/spec/posts/history.jsonl', '{}\n');
  mkdirSync(join(f.repo, '.gitifact/wiki'));
  f.write('.gitifact/wiki/guide.md', '---\nid: W-dddddddddd\n---\n\n# 안내\n\n규칙.\n'); f.write('.gitifact/wiki/history.jsonl', '{}\n');
  f.git(['add', '-A']); f.git(['commit', '-m', '0.7 records']);
  assert.equal(f.run(['check']).status, 1);
  unlinkSync(join(f.repo, '.gitifact/spec/posts/requirements.md')); unlinkSync(join(f.repo, '.gitifact/spec/posts/history.jsonl'));
  put(f, { kind: 'feature', path: docPaths[0], id: S, feature: 'posts', title: '게시물', description: '게시물 작성과 조회', body: '게시물 기능.' });
  put(f, { kind: 'requirement', path: docPaths[1], id: R, feature: 'posts', order: 10, title: '저장', description: '제목을 입력해 저장한다', body: '작성자로서 게시물을 저장하고 싶다.' });
  const instruction = '.gitifact/instructions/guide/index.md';
  const reason = record(f, H, [S, R], '게시물 저장을 처음 정리함');
  const old = ['.gitifact/spec/posts/requirements.md', '.gitifact/spec/posts/history.jsonl', '.gitifact/wiki/guide.md', '.gitifact/wiki/history.jsonl'];
  const migration = { paths: [reason, ...docPaths, ...old], message: 'Migrate to 0.8.0', authorization, migration: true };
  // A wiki page left in place fails the check, even in a migration commit; so does a reason file of the 0.8 drafts.
  f.write('.gitifact/history.jsonl', '{}\n');
  const refused = f.commit(migration);
  assert.equal(JSON.parse(refused.stderr).error.code, 'DOCS_CHECK_FAILED');
  assert.deepEqual(JSON.parse(refused.stderr).error.problems.map(p => p.code).sort(), ['REASONS_FILE_REMOVED', 'WIKI_REMOVED']);
  unlinkSync(join(f.repo, '.gitifact/history.jsonl'));
  unlinkSync(join(f.repo, '.gitifact/wiki/guide.md')); unlinkSync(join(f.repo, '.gitifact/wiki/history.jsonl'));
  put(f, { kind: 'instruction', path: instruction, id: 'I-dddddddddd', name: 'guide', title: '안내', description: '작업 규칙. 코드를 바꿀 때 읽는다.', body: '규칙.' });
  const result = f.done(f.commit({ ...migration, paths: [...migration.paths, instruction] }));
  assert.ok(result.trailers.includes('Gitifact-Migration: 0.8.0'));
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, /\nGitifact-Migration: 0\.8\.0\n/);
  assert.equal(f.git(['status', '--porcelain']).stdout, '');
  assert.deepEqual(f.ok(['records', 'list', '--doc', R]).events, []);
});

test('a migration commit takes a whole project past the 128-path limit of other commits', t => {
  const f = setup(t);
  // More paths than one command line holds on Windows, with spaces and non-ASCII names, so Git reads them from standard input.
  const many = Array.from({ length: 300 }, (_, i) => `assets dir/그림 ${String(i).padStart(3, '0')} ${'x'.repeat(80)}.png`);
  mkdirSync(join(f.repo, '.gitifact/assets/assets dir'), { recursive: true });
  for (const name of many) writeFileSync(join(f.repo, '.gitifact/assets', name), 'png ' + name);
  const paths = [...docPaths, ...codePaths, ...many.map(name => '.gitifact/assets/' + name)];
  const refused = f.commit(request({ paths }));
  assert.equal(refused.status, 1); assert.equal(JSON.parse(refused.stderr).error.code, 'INVALID_COMMIT');
  assert.equal(f.git(['rev-list', '--count', 'HEAD']).stdout.trim(), '1');
  const result = f.done(f.commit(request({ paths, migration: true })));
  assert.equal(result.paths.length, 304); assert.ok(result.trailers.includes('Gitifact-Migration: 0.8.0'));
  assert.equal(f.git(['ls-tree', '-r', '--name-only', 'HEAD', '--', '.gitifact/assets']).stdout.trim().split('\n').length, 300);
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, /^Add post saving\n\n(Gitifact-[A-Za-z]+: .+\n)*Gitifact-Migration: 0\.8\.0\n/);
  assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, '');
  assert.equal(f.commit(request({ paths: Array.from({ length: 5001 }, (_, i) => `f${i}.js`), migration: true })).status, 1);
});

