import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync, utimesSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { browserProjectV1 } from '@tryce/contracts';
import { startBrowserServer } from '../.test-build/server/browser-server.js';
import { readBrowserProject, createBrowserProjectReader } from '../.test-build/server/project-reader.js';
import { readBrief } from '../.test-build/commands/brief.js';
import { initializeProject } from '../.test-build/commands/init.js';
import { reqCommand } from '../.test-build/commands/req.js';
import { noteCommand } from '../.test-build/commands/note.js';
import { fixture, fingerprint } from './git-fixture.mjs';

test('project HTTP preserves complete text, historical approval and repository files', async (t) => {
  const f = fixture(t);
  await initializeProject(f.repo, { mode: 'auto' }, f.env);
  const req = (action, ids = [], options = {}) => reqCommand(f.repo, action, ids, options, f.env);
  const first = (
    await req('draft', [], {
      spec: 'search',
      title: '검색',
      message: '**원래 내용**',
      author: 'Fixture',
      reason: '테스트 자료',
    })
  ).result;
  const review = (await req('review', [first.id])).result;
  await req('approve', [review.id], {
    by: 'Fixture operator',
    evidence: 'Simulated approval for automated test only',
  });
  await req('revise', [first.id], {
    title: '검색 설명',
    message: '새 내용',
    author: 'Fixture',
    reason: '설명 수정',
    expected: first.revision,
    amend: true,
  });
  await noteCommand(
    f.repo,
    'add',
    { type: 'constraint', message: '긴 본문 '.repeat(200), author: 'Fixture' },
    undefined,
    f.env,
  );
  const before = fingerprint(f.repo);
  const server = await startBrowserServer({
    cwd: f.repo,
    env: f.env,
    assetsDirectory: fileURLToPath(new URL('../dist/browser/', import.meta.url)),
  });
  try {
    for (const [options, expected] of [
      [{}, 409],
      [{ headers: { 'X-Tryce-Session': 'wrong' } }, 409],
      [{ method: 'POST', headers: { 'X-Tryce-Session': server.session.sessionId } }, 405],
      [{ headers: { Origin: 'https://evil.example', 'X-Tryce-Session': server.session.sessionId } }, 403],
    ]) {
      assert.equal((await fetch(server.url + '/api/v1/project', options)).status, expected);
    }
    assert.equal(
      (
        await fetch(server.url + '/api/v1/project?path=elsewhere', {
          headers: { 'X-Tryce-Session': server.session.sessionId },
        })
      ).status,
      400,
    );
    const response = await fetch(server.url + '/api/v1/project', {
      headers: { 'X-Tryce-Session': server.session.sessionId },
    });
    assert.equal(response.status, 200);
    const data = browserProjectV1.parse(await response.json());
    assert.equal(data.requirements.state, 'available');
    const item = data.requirements.data[0];
    assert.equal(item.state, 'draft');
    assert.equal(item.approval, 'not-approved');
    assert.equal(item.text, '새 내용');
    assert.equal(item.revisions.length, 2);
    assert.equal(item.decisions[0].kind, 'approval');
    assert.match(item.reviews[0].items[0].document, /원래 내용/);
    assert.equal(item.implementation, 'not-assessed');
    assert.equal(data.brief.report.notes.data.items[0].text, '긴 본문 '.repeat(200));
    assert.equal(data.brief.report.notes.data.items[0].textTruncated, false);
    assert.deepEqual(fingerprint(f.repo), before);
  } finally {
    await server.close();
  }
});

test('cached observations recheck contents, index, HEAD, documents and locks without hiding failures', async (t) => {
  const f = fixture(t);
  await initializeProject(f.repo, { mode: 'auto' }, f.env);
  await reqCommand(f.repo, 'draft', [], { spec: 'search', title: 'Search', message: 'Original', author: 'Fixture', reason: 'Fixture' }, f.env);
  f.commit('baseline records');
  const read = createBrowserProjectReader(f.repo, f.env);
  const first = await read();
  assert.equal(first.brief.ok, true);
  const id = data => data.brief.report?.observation.id;
  assert.equal(id(await read()), id(first));
  const [a, b] = await Promise.all([read(), read()]);
  assert.equal(a, b);

  // Stage a different history and restore the exact working bytes. A cache based
  // only on working files or porcelain XY would incorrectly return success.
  const path = '.tryce/spec/search/tryce.json';
  const original = readFileSync(join(f.repo, path), 'utf8');
  const bad = JSON.parse(original); bad.requirements[0].revisions[0].text = 'Tampered';
  f.write(path, JSON.stringify(bad)); f.git(['add', path]); f.write(path, original);
  assert.equal((await read()).requirements.error.code, 'RECORD_HISTORY_CHANGED');
  f.git(['reset', 'HEAD', '--', path]);
  const restored = await read();
  assert.equal(restored.brief.ok, true); assert.notEqual(id(restored), id(first));

  // Preserve size and mtime: cache validation must read bytes, not trust metadata.
  const stat = statSync(join(f.repo, path));
  f.write(path, original.replace('Original', 'Modified'));
  utimesSync(join(f.repo, path), stat.atime, stat.mtime);
  assert.equal((await read()).requirements.error.code, 'RECORD_HISTORY_CHANGED');
  f.write(path, original);
  assert.equal((await read()).brief.ok, true);
  f.write('.tryce/.notes.lock', 'fixture lock');
  assert.equal((await read()).requirements.error.code, 'PROJECT_BUSY');
  unlinkSync(join(f.repo, '.tryce/.notes.lock'));
  const unlocked = await read(); assert.equal(unlocked.brief.ok, true);

  mkdirSync(join(f.repo, 'docs')); f.write('docs/new.md', 'new document');
  const docs = await read(); assert.notEqual(id(docs), id(unlocked));
  assert(docs.brief.report.documents.data.items.some(item => item.path === 'docs/new.md'));
  f.commit('documents');
  const head = await read(); assert.notEqual(head.brief.report.git.head.commit, docs.brief.report.git.head.commit);

  await noteCommand(f.repo, 'add', { type: 'discovery', message: 'New note', author: 'Fixture' }, undefined, f.env);
  const note = await read(); assert.equal(note.brief.report.notes.data.items[0].text, 'New note');
  const notePath = note.brief.report.notes.data.items[0].path;
  f.write(notePath, '{');
  assert.equal((await read()).brief.report.notes.state, 'error');
  f.write('.tryce/config.json', '{');
  assert.equal((await read()).brief.report.project.state, 'error');
});

test('shared brief requirements reject a record change or lock appearing before final verification', async (t) => {
  const f = fixture(t);
  await initializeProject(f.repo, { mode: 'auto' }, f.env);
  await reqCommand(f.repo, 'draft', [], { spec: 'search', title: 'Search', message: 'Original', author: 'Fixture', reason: 'Fixture' }, f.env);
  const path = '.tryce/spec/search/tryce.json';
  const original = readFileSync(join(f.repo, path), 'utf8');
  let published = false;
  const result = await readBrief(f.repo, { all: true }, f.env, async () => {
    f.write(path, original.replace('Original', 'Modified'));
  }, () => { published = true; });
  assert.equal(result.report.requirements.state, 'error');
  assert.equal(published, false);
  const locked = await readBrief(f.repo, {}, f.env, async () => {
    f.write('.tryce/.notes.lock', 'fixture lock');
  });
  assert.equal(locked.report?.requirements.state === 'error' || locked.report === null, true);
});

test('unconfigured and broken records are not represented as an empty valid project', async (t) => {
  const f = fixture(t);
  assert.equal((await readBrowserProject(f.repo, f.env)).requirements.state, 'not-available');
  await initializeProject(f.repo, { mode: 'auto' }, f.env);
  await reqCommand(
    f.repo,
    'draft',
    [],
    { spec: 'search', title: '검색', message: '검색', author: 'Fixture', reason: 'Fixture' },
    f.env,
  );
  f.write('.tryce/spec/search/tryce.json', 'broken JSON');
  const before = fingerprint(f.repo);
  const data = await readBrowserProject(f.repo, f.env);
  assert.equal(data.requirements.state, 'error');
  assert.equal(data.brief.ok, false);
  assert.deepEqual(fingerprint(f.repo), before);
});
