import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openCache } from '../.test-build/adapters/cache/index.js';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';
import { createCheckoutReader } from '../.test-build/server/checkout/checkout-reader.js';
import { createStampReader } from '../.test-build/server/checkout/stamp.js';
import { withLanguage } from '../.test-build/shared/i18n/index.js';
import { projectFixture } from './git-fixture.mjs';

const readerOf = f => {
  const git = storeReader(f.repo);
  const cache = openCache(f.repo, { run: (args, input) => git.run(args, input), decode: git.decode, legacyBundles: oids => git.readBundles(oids) });
  return createCheckoutReader(f.repo, cache, f.env);
};

test('a checkout request with an unchanged stamp answers with the last read, and any change the screens show reads again', async t => {
  const f = projectFixture(t);
  const created = f.ok(['specs', 'new', 'feature', 'search', '--title', '검색', '--description', '검색 기능']);
  const checkout = readerOf(f);
  const stamp = createStampReader(f.repo, f.env);
  const first = await checkout.base();
  assert.deepEqual(first.features.map(x => x.title), ['검색']);
  // Nothing changed: the same read comes back, stamped as seen now.
  const again = await checkout.base();
  assert.equal(again.features, first.features);
  assert.equal(again.stamp, first.stamp);
  assert.ok(again.observedAt >= first.observedAt);
  // A document edited again while already uncommitted changes its size, and so the stamp.
  const path = join(f.repo, created.path);
  writeFileSync(path, readFileSync(path, 'utf8').replace('title: 검색', 'title: 검색 개선'));
  const edited = await checkout.base();
  assert.notEqual(edited.stamp, again.stamp);
  assert.deepEqual(edited.features.map(x => x.title), ['검색 개선']);
  // A commit moves HEAD.
  f.commit('search');
  const committed = await checkout.base();
  assert.notEqual(committed.stamp, edited.stamp);
  assert.equal(committed.working, false);
  assert.equal(committed.features[0].state, 'committed');
  // .mailmap names the people, so it is part of the stamp even outside the store.
  const before = await stamp();
  f.write('.mailmap', 'Renamed <fixture@example.invalid>\n');
  assert.notEqual(await stamp(), before);
  const renamed = await checkout.base();
  assert.notEqual(renamed.features, committed.features);
  // Each language keeps its own last read: problems and messages are worded in it.
  const english = await withLanguage('en', () => checkout.base());
  assert.notEqual(english.features, renamed.features);
  assert.equal((await withLanguage('en', () => checkout.base())).features, english.features);
});
