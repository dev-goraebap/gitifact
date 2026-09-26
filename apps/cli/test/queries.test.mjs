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
