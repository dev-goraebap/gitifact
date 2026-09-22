import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, utimesSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { classifyDocPath, parseDocumentFile, parseReasonLines } from '@gitifact/core';
import { fixture, fingerprint } from './git-fixture.mjs';
import { openRecords, docs } from './browser-records.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { startBrowserServer } from '../.test-build/server/browser-server.js';

const cacheFile = f => join(f.repo, '.gitifact', 'cache', 'index.db');
// Everything but the cache, which is derived, ignored by Git and not part of the project.
const project = f => { const all = fingerprint(f.repo); for (const key of Object.keys(all)) if (key.startsWith('.gitifact/cache')) delete all[key]; return all; };
const S = 'S-aaaaaaaaaa', R = 'R-aaaaaaaaaa', R2 = 'R-bbbbbbbbbb', D = 'D-aaaaaaaaaa', D2 = 'D-bbbbbbbbbb', W = 'W-aaaaaaaaaa';
async function adopted(t) { const f = fixture(t); await initializeSpecProject(f.repo, false, f.env); return { f, d: docs(f) }; }

test('the browser reads the checkout and history without touching the project, and keeps its cache out of Git', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S, { title: 'Posts' });
  d.requirement('posts', 'save', R, { title: 'Save', order: 20, body: 'First' });
  d.requirement('posts', 'list', R2, { title: 'List', order: 10 });
  d.design('posts', 'overview', D, { title: 'Overview', requirements: [R], sources: [{ id: W, note: 'rules' }, { title: 'Spec', url: 'https://example.test/' }] });
  d.design('posts', 'api', D2, { title: 'API', order: 20 });
  d.wiki('guide.md', W, { title: 'Guide' });
  f.commit('Create');
  d.requirement('posts', 'save', R, { title: 'Save', order: 20, body: 'Second' }); f.commit('Modify');
  d.requirement('posts', 'save', R, { title: 'Save', order: 20, body: 'Draft' });
  const original = project(f); const read = openRecords(f.repo, f.env);
  const result = await read();
  assert.equal(result.total, 7); assert.deepEqual(result.events[0].types, ['modified']); assert.equal(result.events[0].id, R);
  // The list names the change; its text on both sides is read by key.
  assert.equal('body' in result.events[0].after, false); assert.equal(result.events[0].after.specId, S);
  const change = await read.change(result.events[0].key);
  assert.deepEqual([change.before.body, change.after.body, change.after.order, change.after.kind], ['First', 'Second', 20, 'requirement']);
  assert.equal(await read.change(result.head + ':R-zzzzzzzzzz'), undefined);
  // Documents arrive in order, with the design's sources resolved to the documents they name.
  const [feature] = result.features;
  assert.deepEqual(feature.requirements.map(r => [r.id, r.order, r.body]), [[R2, 10, 'List 본문'], [R, 20, 'Draft']]);
  assert.deepEqual(feature.designs.map(x => x.id), [D, D2]);
  assert.deepEqual(feature.designs[0].sources, [{ id: W, title: 'Guide', path: '.gitifact/wiki/guide.md', note: 'rules' }, { title: 'Spec', url: 'https://example.test/' }]);
  assert.deepEqual([feature.id, feature.body, result.documents[0].description, result.working, result.contributors[0].commits], [S, 'Posts 본문', 'Guide 설명', true, 2]);
  // The project is as it was; the cache is in .gitifact/cache with a .gitignore of `*`, so `git status` shows only the edit.
  assert.deepEqual(project(f), original); assert.ok(existsSync(cacheFile(f)));
  assert.equal(readFileSync(join(f.repo, '.gitifact/cache/.gitignore'), 'utf8'), '*\n');
  assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']).stdout, ' M .gitifact/spec/posts/requirements/save.md\n');
  // A broken file is reported and left out instead of failing the whole checkout.
  f.write('.gitifact/spec/posts/requirements/save.md', 'broken');
  const broken = await read();
  assert.deepEqual(broken.problems.map(p => [p.code, p.path]), [['FRONTMATTER_REQUIRED', '.gitifact/spec/posts/requirements/save.md']]);
  assert.deepEqual(broken.features[0].requirements.map(r => r.id), [R2]);
});

test('the server refuses bad queries, missing sessions and other methods on every records route', async t => {
  const { f } = await adopted(t); f.commit('init');
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory: fileURLToPath(new URL('../../browser/dist/', import.meta.url)) }); t.after(() => server.close());
  const headers = { 'X-Gitifact-Session': server.session.sessionId };
  const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const status = async (path, init = { headers }) => (await fetch(server.url + path, init)).status;
  assert.equal(await status('/api/v1/specs', {}), 409);
  assert.equal(await status('/api/v1/specs?path=..'), 400);
  assert.equal(await status('/api/v1/specs'), 200);
  assert.equal(await status('/api/v1/specs', { headers, method: 'POST' }), 405);
  // History needs the HEAD it is read against; a page and the filters are checked before anything is read.
  assert.equal(await status('/api/v1/history'), 400);
  assert.equal(await status('/api/v1/history?head=nope'), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&head=' + head), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&limit=0'), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&limit=101'), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&kind=renamed'), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&unknown=1'), 400);
  assert.equal(await status('/api/v1/history?head=' + head + '&kind=created&document=feature&offset=0&limit=10&q=x'), 200);
  assert.equal(await status('/api/v1/history?head=' + head + '&id=R-aaaaaaaaaa'), 200);
  assert.equal(await status('/api/v1/history?head=' + head + '&id=R-1'), 400);
  assert.equal(await status('/api/v1/history/summary?head=' + head), 200);
  assert.equal(await status('/api/v1/change?key=nope'), 400);
  assert.equal(await status('/api/v1/change?key=' + head + ':D-zzzzzzzzzz'), 404);
  assert.equal(await status('/api/v1/search'), 400);
  assert.equal(await status('/api/v1/search?q=x&head=' + head), 200);
  assert.equal(await status('/api/v1/nothing'), 404);
});

test('a page holds fifty changes and may end inside a commit, and the pages cover history exactly once', async t => {
  const { f, d } = await adopted(t);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const ids = Array.from({ length: 70 }, (_, i) => 'R-abcdefgh' + alphabet[i >> 5] + alphabet[i & 31]);
  // One commit creates seventy requirements; it is split across the first two pages.
  d.feature('posts', S); ids.forEach((id, i) => d.requirement('posts', 'r' + i, id, { order: i })); f.commit('Adopt');
  f.write('unrelated.txt', 'code only'); f.commit('Code');
  for (let i = 1; i <= 3; i++) { d.requirement('posts', 'r' + i, ids[i], { order: i, body: 'v' + i }); f.commit('Edit ' + i); }
  const { history } = openRecords(f.repo, f.env); const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const first = await history.page(head, {}, 0, 50); assert.equal(first.events.length, 50); assert.equal(first.total, 74);
  // Three edit commits come first (newest first), then 47 of the adoption commit's 71 creations.
  assert.deepEqual(first.events.slice(0, 3).map(e => e.types), [['modified'], ['modified'], ['modified']]);
  const second = await history.page(head, {}, 50, 50); assert.equal(second.events.length, 24);
  const keys = [...first.events, ...second.events].map(e => e.key); assert.equal(new Set(keys).size, 74);
});

test('filters and the search word apply to all of history, and the count is the whole count', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S, { title: 'posts' }); d.requirement('posts', 'main', R, { title: 'posts 요구사항', body: '1' }); f.commit('posts');
  // The fixture fixes the author through its environment, so Bob's commit names him explicitly.
  d.feature('tags', 'S-bbbbbbbbbb', { title: 'tags' }); d.requirement('tags', 'main', R2, { title: 'tags 요구사항', body: '1' });
  f.git(['add', '-A']); f.git(['commit', '-m', 'tags', '--author', 'Bob <bob@example.invalid>']);
  for (let i = 2; i <= 60; i++) { d.requirement('posts', 'main', R, { title: 'posts 요구사항', body: String(i) }); f.commit('posts ' + i); }
  const { history } = openRecords(f.repo, f.env); const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const all = await history.page(head, {}, 0, 100); assert.equal(all.total, 63);
  // Bob's changes are older than a first page of fifty, and the filter still finds them.
  assert.equal((await history.page(head, {}, 0, 50)).events.some(e => e.email === 'bob@example.invalid'), false);
  const bob = await history.page(head, { author: 'bob@example.invalid' }, 0, 50); assert.equal(bob.total, 2);
  assert.equal((await history.page(head, { feature: 'S-bbbbbbbbbb' }, 0, 50)).total, 2);
  assert.equal((await history.page(head, { kind: 'created' }, 0, 50)).total, 4);
  assert.equal((await history.page(head, { kind: 'modified' }, 0, 50)).total, 59);
  assert.equal((await history.page(head, { document: 'feature' }, 0, 50)).total, 2);
  assert.equal((await history.page(head, { document: 'wiki' }, 0, 50)).total, 0);
  assert.equal((await history.page(head, { q: 'tags 요구' }, 0, 50)).total, 1);
  // One document's changes: R2 was created once; R changed in every posts commit.
  assert.equal((await history.page(head, { id: R2 }, 0, 50)).total, 1);
  assert.equal((await history.page(head, { id: R, author: 'bob@example.invalid' }, 0, 50)).total, 0);
  assert.equal((await history.page(head, { id: R }, 0, 100)).total, 60);
  // Each filter's pages together are exactly the matching changes of the whole list.
  const created = []; for (let i = 0; i < 4; i++) created.push(...(await history.page(head, { kind: 'created' }, i, 1)).events);
  assert.deepEqual(created.map(e => e.key), all.events.filter(e => e.types.includes('created')).map(e => e.key));
  const summary = await history.summary(head);
  assert.equal(summary.total, 63); assert.deepEqual(summary.byType, { created: 4, modified: 59, moved: 0, deleted: 0 });
  assert.equal(summary.recent.length, 3); assert.equal(summary.recent[0].events[0].key, all.events[0].key);
  assert.deepEqual((await history.ofDocument(head, 'R-bbbbbbbbbb')).map(e => e.types), [['created']]);
});

test('the cache is kept between readers, grows with new commits, and rebuilds when damaged or of another format', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S); d.requirement('posts', 'save', R, { body: 'One' }); f.commit('One');
  d.requirement('posts', 'save', R, { body: 'Two' }); f.commit('Two');
  const head = () => f.git(['rev-parse', 'HEAD']).stdout.trim();
  const keys = async () => (await openRecords(f.repo, f.env).history.page(head(), {}, 0, 50)).events.map(e => e.key);
  const first = await keys(); assert.equal(first.length, 3);
  const stored = () => { const db = new DatabaseSync(cacheFile(f)); try { return db.prepare('SELECT count(*) AS n FROM commits').get().n; } finally { db.close(); } };
  assert.equal(stored(), 2);
  // A second reader reads nothing again; a new commit adds only itself.
  assert.deepEqual(await keys(), first);
  d.requirement('posts', 'save', R, { body: 'Three' }); f.commit('Three');
  const grown = await keys(); assert.equal(grown.length, 4); assert.deepEqual(grown.slice(1), first); assert.equal(stored(), 3);
  // Damaged: removed and made anew, with the same answer.
  writeFileSync(cacheFile(f), 'not a database'); for (const extra of ['-wal', '-shm']) rmSync(cacheFile(f) + extra, { force: true });
  assert.deepEqual(await keys(), grown); assert.equal(stored(), 3);
  // Written under another format number: dropped and rebuilt.
  { const db = new DatabaseSync(cacheFile(f)); db.exec('PRAGMA user_version = 999'); db.close(); }
  assert.deepEqual(await keys(), grown);
  // Deleted: the same commands make it again.
  rmSync(join(f.repo, '.gitifact/cache'), { recursive: true, force: true });
  assert.deepEqual(await keys(), grown); assert.ok(existsSync(join(f.repo, '.gitifact/cache/.gitignore')));
});

test('the document cache reparses a file only when its time or size changed, and forgets deleted files', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S); const path = d.requirement('posts', 'save', R, { body: 'AAAA' });
  const { cache } = openRecords(f.repo, f.env);
  const body = async () => (await cache.documents.list()).documents.find(x => x.id === R)?.body;
  // A fixed whole-second time, so setting it again gives the same value on every file system.
  const file = join(f.repo, path); const fixed = new Date('2026-01-01T00:00:00Z'); utimesSync(file, fixed, fixed);
  assert.equal(await body(), 'AAAA');
  // Same size and time: the cache answers without reading the file again. This is the trade the design makes.
  writeFileSync(file, readFileSync(file, 'utf8').replace('AAAA', 'BBBB')); utimesSync(file, fixed, fixed);
  assert.equal(await body(), 'AAAA');
  // A new time or size is read.
  d.requirement('posts', 'save', R, { body: 'CCCCC' }); assert.equal(await body(), 'CCCCC');
  assert.deepEqual((await cache.documents.referencing(R)), []);
  d.design('posts', 'overview', D, { requirements: [R] }); assert.deepEqual(await cache.documents.referencing(R), [{ from: D, type: 'requirement' }]);
  unlinkSync(file); assert.equal(await body(), undefined); assert.deepEqual(await cache.documents.referencing(R), [{ from: D, type: 'requirement' }]);
});

test('the search finds documents by title, place and text, and past changes by their reasons', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S, { title: 'Posts' }); d.requirement('posts', 'save', R, { title: 'Save', body: '게시물 본문에 캐시를 쓴다.' }); f.commit('posts');
  d.reasons({ id: 'H-aaaaaaaaaa', docs: [R], reason: '느린 조회를 줄이려고 바꿨다.' });
  d.requirement('posts', 'save', R, { title: 'Save', body: '게시물 본문에 캐시를 둔다.' }); f.commit('cache');
  const read = openRecords(f.repo, f.env); const current = await read();
  const find = q => read.cache.search(current.head, q);
  // Two characters are below the trigram index and are still found; three and more use it.
  const short = await find('캐시');
  assert.deepEqual(short.filter(h => h.kind !== 'history').map(h => [h.kind, h.id, h.featureId]), [['requirement', R, S]]); assert.match(short[0].line, /캐시를 둔다/);
  assert.ok((await find('캐시를')).some(h => h.kind === 'requirement'));
  const past = (await find('느린 조회')).filter(h => h.kind === 'history');
  assert.equal(past.length, 1); assert.equal(past[0].key, current.head + ':' + R); assert.match(past[0].line, /느린 조회/);
  // A title match outranks a text match, and pattern characters are taken literally.
  assert.equal((await find('save'))[0].title, 'Save');
  assert.deepEqual(await find('100%'), []);
  // An edited file is found by its new text on the next search, without a server read in between.
  d.requirement('posts', 'save', R, { title: 'Save', body: '새로 쓴 문장.' });
  assert.equal((await find('캐시')).filter(h => h.kind !== 'history').length, 0);
  assert.equal((await find('새로 쓴')).length, 1);
});

test('files that are not documents in history are skipped and do not stop it', async t => {
  const { f, d } = await adopted(t);
  d.put('.gitifact/spec/posts/tryce.json', '{}'); d.put('.gitifact/spec/posts/requirements.md', 'old format'); f.commit('Legacy');
  f.git(['rm', '-q', '.gitifact/spec/posts/tryce.json', '.gitifact/spec/posts/requirements.md']);
  d.feature('posts', S); d.requirement('posts', 'save', R); f.commit('Convert');
  const result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.map(e => [e.message, e.id, e.types]), [['Convert', R, ['created']], ['Convert', S, ['created']]]);
});

// The cache reads only the files each commit changed. Every change it reports must equal what comparing whole trees
// at the commit and its parent reports — computed here independently, from `git ls-tree` and `git show`.
test('reading only changed files reports the same changes, texts and reasons as comparing whole trees', async t => {
  const { f, d } = await adopted(t); f.commit('Adopt gitifact');
  d.feature('posts', S, { title: '게시물' }); d.requirement('posts', 'save', R, { title: '저장' }); d.requirement('posts', 'remove', R2, { title: '삭제', order: 20 });
  d.design('posts', 'overview', D, { requirements: [R] }); d.wiki('guide.md', W, { title: '안내' });
  d.reasons({ id: 'H-aaaaaaaaaa', docs: [R, R2, D], reason: '게시물 기능을 시작한다.' }, { id: 'H-bbbbbbbbbb', docs: [W], reason: '안내를 둔다.' });
  f.commit('Add posts');
  f.write('app.js', 'code'); f.commit('Code only');
  // Update one, move one to another feature, and create that feature.
  d.requirement('posts', 'save', R, { title: '저장', body: '제목과 본문을 저장한다.' });
  d.feature('profile', 'S-bbbbbbbbbb', { title: '프로필' });
  mkdirSync(join(f.repo, '.gitifact/spec/profile/requirements'));
  f.git(['mv', '.gitifact/spec/posts/requirements/remove.md', '.gitifact/spec/profile/requirements/remove.md']);
  d.reasons({ id: 'H-cccccccccc', docs: [R], reason: '본문도 저장한다.' }, { id: 'H-dddddddddd', docs: [R2], reason: '삭제는 프로필 기능이다.' });
  f.commit('Move removal');
  f.git(['mv', '.gitifact/wiki/guide.md', '.gitifact/wiki/rules.md']); d.wiki('rules.md', W, { title: '안내', body: '옮긴 뒤 고친 글.' });
  d.reasons({ id: 'H-eeeeeeeeee', docs: [W], reason: '규칙으로 옮긴다.' }); f.commit('Move guide');
  f.git(['rm', '-q', '.gitifact/spec/posts/design/overview.md']); d.reasons({ id: 'H-ffffffffff', docs: [D], reason: '설계를 다시 쓴다.' }); f.commit('Drop design');

  const tree = rev => {
    const files = new Map();
    for (const path of f.git(['ls-tree', '-r', '--name-only', rev, '--', '.gitifact']).stdout.split('\n').filter(Boolean)) {
      let type; try { type = classifyDocPath(path).type; } catch { continue; }
      if (type !== 'ignored') files.set(path, f.git(['show', rev + ':' + path]).stdout);
    }
    const docsById = new Map(); const reasons = new Map(); const specIds = new Map();
    for (const [path, text] of files) {
      if (classifyDocPath(path).type === 'reasons') { for (const r of parseReasonLines(path, text)) reasons.set(r.id, r); continue; }
      const doc = parseDocumentFile(path, text); docsById.set(doc.id, doc);
      if (doc.kind === 'feature') specIds.set(path.split('/')[2], doc.id);
    }
    return { docsById, reasons, specIds };
  };
  const expected = [];
  for (const line of f.git(['log', '--first-parent', '--format=%H %P', 'HEAD']).stdout.trim().split('\n')) {
    const [commit, parent] = line.split(' ');
    const after = tree(commit); const before = parent ? tree(parent) : { docsById: new Map(), reasons: new Map(), specIds: new Map() };
    const fresh = [...after.reasons.values()].filter(r => !before.reasons.has(r.id));
    for (const id of [...new Set([...before.docsById.keys(), ...after.docsById.keys()])].sort()) {
      const a = before.docsById.get(id); const b = after.docsById.get(id);
      const types = !a ? ['created'] : !b ? ['deleted'] : [...(a.path !== b.path ? ['moved'] : []), ...(JSON.stringify({ ...a, path: 0, feature: 0 }) !== JSON.stringify({ ...b, path: 0, feature: 0 }) ? ['modified'] : [])];
      if (!types.length) continue;
      const side = (doc, t) => doc && { title: doc.title, body: doc.body, path: doc.path, specId: doc.kind === 'wiki' ? 'wiki' : t.specIds.get(doc.path.split('/')[2]) ?? '' };
      expected.push({ key: commit + ':' + id, types, reasons: fresh.filter(r => r.docs.includes(id)).map(r => r.reason), before: side(a, before), after: side(b, after) });
    }
  }
  const read = openRecords(f.repo, f.env); const listed = (await read()).events;
  assert.ok(expected.length >= 9, String(expected.length));
  assert.deepEqual(listed.map(e => e.key), expected.map(e => e.key));
  for (const [i, e] of listed.entries()) {
    const want = expected[i]; assert.deepEqual([e.types, e.reasons], [want.types, want.reasons], e.key);
    const change = await read.change(e.key);
    const pick = s => s && { title: s.title, body: s.body, path: s.path, specId: s.specId };
    assert.deepEqual([pick(change.before), pick(change.after)], [want.before ?? null, want.after ?? null], e.key);
  }
  // The moved requirement and the moved page read as moves, with their reasons; the move changes the feature.
  const moved = listed.find(e => e.id === R2 && e.types.includes('moved'));
  assert.deepEqual([moved.reasons, moved.before.specId, moved.after.specId], [['삭제는 프로필 기능이다.'], S, 'S-bbbbbbbbbb']);
  assert.deepEqual(listed.find(e => e.id === W && e.types.includes('moved')).types, ['moved', 'modified']);
});

test('authors per feature and the latest commit per page match a log per path', async t => {
  const { f, d } = await adopted(t);
  const as = (name, email) => { f.git(['config', 'user.name', name]); f.git(['config', 'user.email', email]); };
  as('Ann', 'ann@example.invalid'); d.feature('posts', S); d.requirement('posts', 'save', R, { body: '1' }); d.wiki('guide.md', W); f.commit('posts 1');
  as('Bob', 'bob@example.invalid'); d.feature('tags', 'S-bbbbbbbbbb'); d.requirement('posts', 'save', R, { body: '2' }); f.commit('both');
  f.write('code.js', 'x'); f.commit('code');
  const result = await openRecords(f.repo, f.env)();
  for (const feature of result.features) {
    const folder = feature.path.replace(/\/index\.md$/, '');
    const lines = f.git(['log', '--format=%aN%x00%aE%x00%aI', 'HEAD', '--', folder]).stdout.trim().split('\n');
    assert.equal(feature.updatedAt, lines[0].split('\0')[2], folder);
    assert.equal(feature.contributors.reduce((n, p) => n + p.commits, 0), lines.length, folder);
  }
  for (const doc of result.documents) assert.equal(doc.updatedAt, f.git(['log', '-1', '--format=%aI', 'HEAD', '--', doc.path]).stdout.trim() || null, doc.path);
});

test('a commit lists the source files it changed beside its documents, and one file reads on both sides', async t => {
  const { f, d } = await adopted(t);
  mkdirSync(join(f.repo, 'src'));
  f.write('src/a.ts', 'one\ntwo\nthree\nfour\nfive\n'); f.write('logo.bin', Buffer.from([0, 1, 2, 0]));
  d.feature('posts', S, { title: 'Posts' }); f.commit('Add');
  const first = f.git(['rev-parse', 'HEAD']).stdout.trim();
  f.git(['mv', 'src/a.ts', 'src/b.ts']); f.write('src/b.ts', 'one\ntwo\nthree\nfour\nsix\n'); unlinkSync(join(f.repo, 'logo.bin'));
  d.feature('posts', S, { title: 'Posts', body: 'Changed' }); f.commit('Move');
  const second = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory: fileURLToPath(new URL('../../browser/dist/', import.meta.url)) }); t.after(() => server.close());
  const get = async path => { const response = await fetch(server.url + path, { headers: { 'X-Gitifact-Session': server.session.sessionId } }); return { status: response.status, body: await response.json() }; };
  // Documents are records and stay out; a rename keeps its old path, a binary file has no line counts. The first
  // commit also carries the .gitattributes rule init wrote.
  const listed = (await get('/api/v1/commit/files?commit=' + second)).body;
  assert.deepEqual([listed.contract, listed.total], ['browser-commit-files', 2]);
  assert.deepEqual(listed.files, [
    { path: 'logo.bin', status: 'deleted', additions: null, deletions: null },
    { path: 'src/b.ts', previousPath: 'src/a.ts', status: 'renamed', additions: 1, deletions: 1 },
  ]);
  assert.deepEqual((await get('/api/v1/commit/files?commit=' + first)).body.files.map(x => [x.path, x.status, x.additions]), [['.gitattributes', 'added', 1], ['logo.bin', 'added', null], ['src/a.ts', 'added', 5]]);
  const moved = (await get('/api/v1/commit/file?commit=' + second + '&path=src/b.ts')).body;
  assert.deepEqual([moved.before, moved.after, moved.binary, moved.tooLarge], ['one\ntwo\nthree\nfour\nfive\n', 'one\ntwo\nthree\nfour\nsix\n', false, false]);
  const logo = (await get('/api/v1/commit/file?commit=' + first + '&path=logo.bin')).body;
  assert.deepEqual([logo.before, logo.after, logo.binary], [null, null, true]);
  // A path the commit did not change, a commit the repository lacks and a malformed commit are refused.
  assert.equal((await get('/api/v1/commit/file?commit=' + second + '&path=.gitifact/config.json')).status, 404);
  assert.equal((await get('/api/v1/commit/files?commit=' + '0'.repeat(second.length))).status, 404);
  assert.equal((await get('/api/v1/commit/files?commit=nope')).status, 400);
});
