import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDocumentFile } from '@gitifact/core';
import { projectFixture, fingerprint } from './git-fixture.mjs';

const S = 'S-aaaaaaaaaa', R = 'R-bbbbbbbbbb', R2 = 'R-cccccccccc';
const history = '.gitifact/history.jsonl';
const docPaths = ['.gitifact/spec/posts/index.md', '.gitifact/spec/posts/requirements/save.md'];
const codePaths = ['app.js', 'app.test.js'];
const authorization = { basis: 'user-request', evidence: 'Fixture explicitly requests this test commit' };
const locks = f => ['gitifact-changes-commit.lock', 'index.lock'].filter(l => existsSync(join(f.repo, '.git', l)));

function put(f, doc) {
  const file = join(f.repo, doc.path); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderDocumentFile(doc));
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
const request = (extra = {}) => ({ reasons: [{ docs: [R], reason: '제목 없는 저장을 방지' }], paths: [history, ...docPaths, ...codePaths], message: 'Add post saving', authorization, ...extra });

for (const format of ['sha1', 'sha256']) test(`dry-run previews without changes, then one command checks, records the reason and commits (${format})`, t => {
  const f = setup(t, format); f.write('unrelated.txt', 'keep outside commit'); const before = fingerprint(f.repo);
  const preview = f.done(f.commit(request(), '--dry-run'));
  assert.deepEqual([preview.outcome, preview.committed, preview.withoutReason], ['dry-run', false, [S]]);
  assert.deepEqual(preview.changes.map(c => [c.id, c.types]), [[R, ['created']], [S, ['created']]]);
  assert.deepEqual(preview.trailers, ['Gitifact-Req: ' + R, 'Gitifact-Doc: ' + S]);
  assert.deepEqual(fingerprint(f.repo), before);
  const result = f.done(f.commit(request()));
  assert.equal(result.outcome, 'committed'); assert.deepEqual(result.paths, [history, ...docPaths, ...codePaths].sort());
  assert.equal(result.commit, f.git(['rev-parse', 'HEAD']).stdout.trim());
  assert.equal(f.git(['status', '--porcelain']).stdout, '?? unrelated.txt\n');
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, new RegExp(`^Add post saving\\n\\nGitifact-Req: ${R}\\nGitifact-Doc: ${S}\\n`));
  const line = JSON.parse(f.git(['show', 'HEAD:' + history]).stdout);
  assert.deepEqual(line, { id: result.reasons[0].id, docs: [R], reason: '제목 없는 저장을 방지' });
  assert.deepEqual(locks(f), []);
  // Nothing left to commit: the selection stages nothing new.
  const head = f.git(['rev-parse', 'HEAD']).stdout;
  assert.equal(f.commit({ paths: codePaths, message: 'Again', authorization }).status, 1); assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head);
});

test('changes list names changed documents, uncommitted reasons, documents without a reason, and the input path', t => {
  const f = setup(t);
  const text = f.run(['changes', 'list']);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, new RegExp(`^HEAD 대비 바뀐 문서 2개\\n  created   ${R} 저장 — ${docPaths[1]}\\n  created   ${S} 게시물 — ${docPaths[0]}\\n이유가 없는 문서: ${R}, ${S}\\n문서 검사: 문제 없음\\n커밋 입력 파일: .*commit\\.json\\n$`));
  f.done(f.commit(request()));
  assert.equal(f.run(['changes', 'list']).stdout.split('\n')[0], 'HEAD 대비 바뀐 문서가 없습니다.');
  // A moved and edited requirement is one change of that document.
  const moved = '.gitifact/spec/posts/requirements/store.md';
  writeFileSync(join(f.repo, moved), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '보관하고 싶다')); unlinkSync(join(f.repo, docPaths[1]));
  const listed = f.ok(['changes', 'list']);
  assert.deepEqual(listed.changes, [{ id: R, kind: 'requirement', types: ['moved', 'modified'], title: '저장', path: moved, previousPath: docPaths[1] }]);
  assert.deepEqual([listed.withoutReason, listed.pendingReasons], [[R], []]);
  // A reason written by hand but not committed is reported as pending.
  writeFileSync(join(f.repo, history), readFileSync(join(f.repo, history), 'utf8') + JSON.stringify({ id: 'H-zzzzzzzzzz', docs: [R], reason: '이름을 바꿈' }) + '\n');
  assert.deepEqual(f.ok(['changes', 'list']).withoutReason, []);
  assert.match(f.run(['changes', 'list']).stdout, /커밋하지 않은 이유 1개\n  H-zzzzzzzzzz R-bbbbbbbbbb: 이름을 바꿈/);
});

test('a failing document check stops the commit before anything is written', t => {
  const f = setup(t);
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('order: 10\n', 'order: 10\ndraft: true\n'));
  // changes list shows the problem before a commit is tried.
  assert.match(f.run(['changes', 'list']).stdout, /\n문서 검사: 문제 1개 \(docs check로 확인\)\n/);
  assert.deepEqual(f.ok(['changes', 'list']).problems.map(p => p.code), ['DOC_DRAFT']);
  const before = fingerprint(f.repo);
  const result = f.commit(request());
  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr).error;
  assert.equal(error.code, 'DOCS_CHECK_FAILED'); assert.deepEqual(error.problems.map(p => p.code), ['DOC_DRAFT']);
  assert.deepEqual(fingerprint(f.repo), before); assert.deepEqual(locks(f), []);
  const text = f.run(['changes', 'commit', '--file', join(f.root, 'input.json')]);
  assert.match(text.stderr, /^DOCS_CHECK_FAILED: .*\n  DOC_DRAFT /);
});

test('missing reasons are reported without blocking, and code-only commits carry no trailers', t => {
  const f = setup(t); const { reasons, ...rest } = request();
  const result = f.done(f.commit({ ...rest, paths: [...docPaths, ...codePaths] }));
  assert.deepEqual(result.withoutReason, [R, S]); assert.deepEqual(result.reasons, []); assert.equal(existsSync(join(f.repo, history)), false);
  f.write('app.js', 'export const save = title => !!title.trim();\n');
  const code = f.done(f.commit({ paths: ['app.js'], message: 'Trim titles', authorization }));
  assert.deepEqual([code.paths, code.trailers], [['app.js'], []]); assert.equal(f.git(['log', '-1', '--format=%B']).stdout.trim(), 'Trim titles');
  // A reason may explain code that implements an unchanged requirement; the requirement is named in a trailer.
  f.write('app.js', 'export const save = title => title.trim().length > 0;\n');
  const explained = f.done(f.commit({ reasons: [{ docs: [R], reason: '공백만 있는 제목도 막음' }], paths: [history, 'app.js'], message: 'Reject blank titles', authorization }));
  assert.deepEqual([explained.changes, explained.trailers], [[], ['Gitifact-Req: ' + R]]);
});

test('unknown documents, malformed reasons and a message with trailers are rejected without changes', t => {
  const f = setup(t); const before = fingerprint(f.repo);
  for (const [extra, code] of [
    [{ reasons: [{ docs: ['R-zzzzzzzzzz'], reason: 'unknown' }] }, 'INVALID_COMMIT'],
    [{ reasons: [{ docs: [R, R], reason: 'duplicate' }] }, 'INVALID_COMMIT'],
    [{ reasons: [{ requirements: [R], reason: 'old shape' }] }, 'INVALID_COMMIT'],
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

test('unpaired selection, files outside the store rules, existing staging and intent-to-add are rejected without changes', t => {
  const f = setup(t); let before = fingerprint(f.repo);
  for (const paths of [codePaths, [docPaths[0], ...codePaths], [...docPaths, ...codePaths]]) {
    assert.equal(f.commit(request({ paths })).status, 1, paths.join()); assert.deepEqual(fingerprint(f.repo), before);
  }
  f.write('.gitifact/scratch.txt', 'x');
  const outside = f.commit(request({ paths: [...request().paths, '.gitifact/scratch.txt'] }));
  assert.equal(outside.status, 1); assert.match(JSON.parse(outside.stderr).error.message, /scratch\.txt/);
  unlinkSync(join(f.repo, '.gitifact/scratch.txt'));
  f.git(['add', 'app.js']); before = fingerprint(f.repo); assert.equal(f.commit(request()).status, 1); assert.deepEqual(fingerprint(f.repo), before);
  const g = setup(t); g.git(['add', '-N', 'app.js']); before = fingerprint(g.repo); assert.equal(g.commit(request()).status, 1); assert.deepEqual(fingerprint(g.repo), before);
});

test('assets travel with the documents they illustrate', t => {
  const f = setup(t); mkdirSync(join(f.repo, '.gitifact/assets')); f.write('.gitifact/assets/logo.svg', '<svg/>');
  const result = f.done(f.commit(request({ paths: [...request().paths, '.gitifact/assets/logo.svg'] })));
  assert.ok(result.paths.includes('.gitifact/assets/logo.svg'));
});

test('a rejected commit restores the reason file and index, then retries cleanly', t => {
  const f = setup(t); f.done(f.commit(request()));
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '임시 저장도 하고 싶다'));
  const hook = join(f.repo, '.git/hooks/pre-commit'); writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  const head = f.git(['rev-parse', 'HEAD']).stdout; const index = readFileSync(join(f.repo, '.git/index')); const reasons = readFileSync(join(f.repo, history));
  const input = { reasons: [{ docs: [R], reason: '임시 저장' }], paths: [history, docPaths[1]], message: 'Drafts', authorization };
  assert.equal(f.commit(input).status, 1);
  assert.deepEqual(readFileSync(join(f.repo, history)), reasons); assert.deepEqual(readFileSync(join(f.repo, '.git/index')), index);
  assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head); assert.deepEqual(locks(f), []);
  unlinkSync(hook); f.done(f.commit(input)); assert.equal(f.git(['rev-list', '--count', 'HEAD']).stdout.trim(), '3');
  assert.equal(readFileSync(join(f.repo, history), 'utf8').trim().split('\n').length, 2);
});

test('a first commit rejected by a hook removes the reason file it created', t => {
  const f = setup(t); writeFileSync(join(f.repo, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n');
  assert.equal(f.commit(request()).status, 1); assert.equal(existsSync(join(f.repo, history)), false); assert.deepEqual(locks(f), []);
});

test('rollback keeps a reason file edited by another process and leaves recovery data', t => {
  const f = setup(t); writeFileSync(join(f.repo, '.git/hooks/pre-commit'), `#!/bin/sh\nprintf edited >> ${history}\nexit 1\n`);
  const result = f.commit(request()); assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).error.code, 'COMMIT_RECOVERY');
  assert.match(readFileSync(join(f.repo, history), 'utf8'), /edited$/);
  assert.equal(existsSync(join(f.repo, '.git/gitifact-changes-commit.lock/recovery.json')), true);
  assert.equal(f.commit(request()).status, 1);
});

test('a CRLF checkout of untouched documents commits without rewriting them (core.autocrlf)', t => {
  const f = setup(t);
  put(f, { kind: 'requirement', path: '.gitifact/spec/posts/requirements/list.md', id: R2, feature: 'posts', order: 20, title: '목록', description: '게시물 목록', body: '목록을 본다.' });
  const all = [...docPaths, '.gitifact/spec/posts/requirements/list.md'];
  f.done(f.commit(request({ paths: [history, ...all, ...codePaths] })));
  // Check the documents out again as Windows does: LF blobs become CRLF files while Git reports them unchanged.
  // The fixture's own Git calls pin core.autocrlf=false; these override it as the project setting does for the CLI.
  f.git(['config', 'core.autocrlf', 'true']); const tracked = [...all, history];
  const crlf = args => f.git(['-c', 'core.autocrlf=true', ...args]);
  for (const p of tracked) unlinkSync(join(f.repo, p));
  crlf(['checkout', '--', ...tracked]);
  for (const p of tracked) assert.match(readFileSync(join(f.repo, p), 'utf8'), /\r\n/);
  assert.equal(crlf(['status', '--porcelain']).stdout, '');
  const untouched = readFileSync(join(f.repo, all[2]));
  assert.deepEqual(f.ok(['changes', 'list']).changes, []);
  writeFileSync(join(f.repo, docPaths[1]), readFileSync(join(f.repo, docPaths[1]), 'utf8').replace('저장하고 싶다', '본문과 함께 저장하고 싶다'));
  f.write('app.js', 'export const save = (title, body) => !!title && !!body;\n');
  const input = { reasons: [{ docs: [R], reason: '본문도 필수로 처리' }], paths: [history, docPaths[1], 'app.js'], message: 'Require body', authorization };
  assert.deepEqual(f.done(f.commit(input, '--dry-run')).changes.map(c => [c.id, c.types]), [[R, ['modified']]]);
  assert.deepEqual(f.done(f.commit(input)).paths, [history, docPaths[1], 'app.js'].sort());
  assert.deepEqual(readFileSync(join(f.repo, all[2])), untouched); assert.equal(crlf(['status', '--porcelain']).stdout, '');
  // The appended reason kept the file's own line endings and Git stored LF.
  assert.doesNotMatch(f.git(['show', 'HEAD:' + history]).stdout, /\r/);
});

test('a Git clean filter that rewrites document content is still rejected and rolled back', t => {
  const f = setup(t); f.git(['config', 'filter.upper.clean', 'tr a-z A-Z']); f.git(['config', 'filter.upper.smudge', 'cat']);
  f.write('.gitattributes', '.gitifact/spec/** filter=upper\n'); const head = f.git(['rev-parse', 'HEAD']).stdout;
  const result = f.commit(request()); assert.equal(result.status, 1); assert.match(JSON.parse(result.stderr).error.message, /Git 필터/);
  assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head); assert.equal(existsSync(join(f.repo, history)), false); assert.deepEqual(locks(f), []);
});

test('a hook changing the commit keeps written reasons and recovery evidence and blocks retries', t => {
  const f = setup(t); writeFileSync(join(f.repo, '.git/hooks/pre-commit'), '#!/bin/sh\nprintf extra > extra.txt\ngit add extra.txt\n');
  const result = f.commit(request()); assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr).error.code, 'COMMIT_UNCERTAIN');
  assert.equal(existsSync(join(f.repo, '.git/gitifact-changes-commit.lock/recovery.json')), true);
  assert.match(readFileSync(join(f.repo, history), 'utf8'), /제목 없는 저장을 방지/);
  const head = f.git(['rev-parse', 'HEAD']).stdout; assert.equal(f.commit(request()).status, 1); assert.equal(f.git(['rev-parse', 'HEAD']).stdout, head);
});

test('a migration commit removes the 0.7 files, carries the migration trailer and stays out of the history', t => {
  const f = setup(t);
  // The 0.7 layout at HEAD: one requirements.md per feature and a reason file in its folder.
  for (const p of docPaths) unlinkSync(join(f.repo, p));
  f.write('.gitifact/spec/posts/requirements.md', '---\nid: S-aaaaaaaaaa\n---\n\n# 게시물\n');
  f.write('.gitifact/spec/posts/history.jsonl', '{}\n');
  f.git(['add', '-A']); f.git(['commit', '-m', '0.7 records']);
  assert.equal(f.run(['docs', 'check']).status, 1);
  unlinkSync(join(f.repo, '.gitifact/spec/posts/requirements.md')); unlinkSync(join(f.repo, '.gitifact/spec/posts/history.jsonl'));
  put(f, { kind: 'feature', path: docPaths[0], id: S, feature: 'posts', title: '게시물', description: '게시물 작성과 조회', body: '게시물 기능.' });
  put(f, { kind: 'requirement', path: docPaths[1], id: R, feature: 'posts', order: 10, title: '저장', description: '제목을 입력해 저장한다', body: '작성자로서 게시물을 저장하고 싶다.' });
  const migration = { reasons: [{ docs: [S, R], reason: '0.8.0 형식으로 옮김' }], paths: [history, ...docPaths], message: 'Migrate to 0.8.0', authorization, migration: true };
  // The old files' deletions belong to the same commit.
  assert.equal(JSON.parse(f.commit(migration).stderr).error.code, 'INVALID_COMMIT');
  const result = f.done(f.commit({ ...migration, paths: [...migration.paths, '.gitifact/spec/posts/requirements.md', '.gitifact/spec/posts/history.jsonl'] }));
  assert.ok(result.trailers.includes('Gitifact-Migration: 0.8.0'));
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, /\nGitifact-Migration: 0\.8\.0\n/);
  assert.equal(f.git(['status', '--porcelain']).stdout, '');
  assert.deepEqual(f.ok(['docs', 'history', R]).events, []);
});
