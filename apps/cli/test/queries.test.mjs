import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './git-fixture.mjs';
import { docs } from './browser-records.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';
import { openCache } from '../.test-build/adapters/cache/index.js';
import { pageOf } from '../.test-build/queries/paging.js';

const S = 'S-aaaaaaaaaa', R = 'R-aaaaaaaaaa';

test('a page starts after its cursor, ends with the next one, and a cursor that is gone answers nothing', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(pageOf(rows, r => r, { limit: 2 }), { rows: ['a', 'b'], total: 5, next: 'b' });
  assert.deepEqual(pageOf(rows, r => r, { limit: 2, after: 'b' }), { rows: ['c', 'd'], total: 5, next: 'd' });
  assert.deepEqual(pageOf(rows, r => r, { limit: 2, after: 'd' }), { rows: ['e'], total: 5, next: null });
  assert.deepEqual(pageOf(rows, r => r, { all: true }), { rows, total: 5, next: null });
  assert.equal(pageOf(rows, r => r, { after: 'z' }), undefined);
});

test('the text of a change comes from the originals the cache is given', async t => {
  const f = fixture(t); await initializeSpecProject(f.repo, false, f.env); const d = docs(f);
  d.feature('posts', S); d.requirement('posts', 'save', R, { body: 'First' }); f.commit('Add');
  d.requirement('posts', 'save', R, { body: 'Second' }); f.commit('Edit');
  const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const git = storeReader(f.repo); const asked = [];
  const originals = {
    async sides(places) { asked.push(...places.map(p => p.rev)); return places.map(p => ({ id: R, kind: 'requirement', title: 'From a snapshot', description: '', body: p.rev, specId: p.specId, path: p.path, order: 10 })); },
    async tree() { return new Map(); },
  };
  const cache = openCache(f.repo, { run: (args, input) => git.run(args, input), decode: git.decode }, originals);
  const change = await cache.history.commitChange(head, R);
  assert.deepEqual([change.before.title, change.after.body], ['From a snapshot', head]);
  assert.equal(asked.length, 2);
  assert.deepEqual([...await cache.history.filesAt(head)], []);
});

test('a document history pages its commits newest first and counts what records explain over all of them', async t => {
  const { documentHistory, documentHistoryPage } = await import('../.test-build/queries/document-history.js');
  const f = fixture(t); await initializeSpecProject(f.repo, false, f.env); const d = docs(f);
  d.feature('posts', S); d.requirement('posts', 'save', R, { title: 'Save' }); f.commit('Add');
  d.requirement('posts', 'save', R, { title: 'Save', body: 'Edited without a record' }); f.commit('Edit');
  d.requirement('posts', 'save', R, { title: 'Save drafts', body: 'Edited with a record' });
  d.record({ id: 'DR-aaaaaaaaaa', docs: [R], reason: 'Drafts were lost' }); f.commit('Drafts');
  const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const git = storeReader(f.repo);
  const source = { cache: openCache(f.repo, { run: (args, input) => git.run(args, input), decode: git.decode }) };
  const first = await documentHistoryPage(source, head, R, { limit: 2 });
  assert.deepEqual(first.doc, { id: R, title: 'Save drafts', kind: 'requirement', path: '.gitifact/spec/posts/requirements/save.md' });
  assert.deepEqual([first.total, first.recorded, first.withoutRecord], [3, 1, 1]);
  assert.deepEqual(first.events.map(e => e.message), ['Drafts', 'Edit']);
  assert.deepEqual(first.events[0].records.map(r => r.id), ['DR-aaaaaaaaaa']);
  const rest = await documentHistoryPage(source, head, R, { after: first.next, limit: 2 });
  assert.deepEqual([rest.events.map(e => e.message), rest.next], [['Add'], null]);
  assert.equal(await documentHistoryPage(source, head, R, { after: 'f'.repeat(40) }), null);
  // Once deleted, the document is named by its last change; a document never held nor changed is unknown.
  f.git(['rm', '-q', '.gitifact/spec/posts/requirements/save.md']); f.commit('Remove');
  const gone = await documentHistory(source, f.git(['rev-parse', 'HEAD']).stdout.trim(), R);
  assert.deepEqual([gone.doc.title, gone.events.length], ['Save drafts', 4]);
  assert.equal(await documentHistory(source, head, 'R-zzzzzzzzzz'), undefined);
});
