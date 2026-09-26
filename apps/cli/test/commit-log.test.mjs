import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './git-fixture.mjs';
import { docs } from './browser-records.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';
import { openCache } from '../.test-build/adapters/cache/index.js';

const S = 'S-aaaaaaaaaa', S2 = 'S-bbbbbbbbbb', R = 'R-aaaaaaaaaa', I = 'I-aaaaaaaaaa';

/** A cache over the fixture whose Git calls are counted: `calls()` is how many ran since the last time it was asked. */
function counted(root) {
  const git = storeReader(root); let n = 0;
  const cache = openCache(root, { run: (args, input) => { n++; return git.run(args, input); }, decode: git.decode, legacyBundles: oids => git.readBundles(oids) });
  return { cache, calls: () => { const was = n; n = 0; return was; } };
}
/** Who committed to HEAD as Git counts it, migrations left out: [email, name of the newest commit, commits]. */
function expected(f, rev = 'HEAD', path) {
  const lines = f.git(['log', '-E', '--invert-grep', '--grep=^Gitifact-Migration: ', '--format=%aN%x00%aE', rev, '--', ...(path ? [path] : [])]).stdout.trim().split('\n').filter(Boolean);
  const people = new Map();
  for (const line of lines) { const [name, email] = line.split('\0'); const p = people.get(email); if (p) p[2]++; else people.set(email, [email, name, 1]); }
  return [...people.values()].sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
}
const shape = people => people.map(p => [p.email, p.name, p.commits]);
async function adopted(t) { const f = fixture(t); await initializeSpecProject(f.repo, false, f.env); return { f, d: docs(f) }; }
const as = (f, name, message, extra = []) => f.git(['commit', '--allow-empty', '-m', message, '--author', `${name} <${name.toLowerCase()}@example.invalid>`, ...extra]);

test('contributors and folder authors follow HEAD through commits, branches, resets and a .mailmap', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S); d.requirement('posts', 'save', R); d.instruction('rules', I); f.git(['add', '-A']); as(f, 'Ann', 'posts');
  f.write('code.js', '1'); f.git(['add', '-A']); as(f, 'Bob', 'code');
  const { cache, calls } = counted(f.repo);
  let head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.deepEqual(shape(await cache.log.contributors(head)), expected(f));
  const folders = await cache.log.folders(head);
  assert.deepEqual(shape(folders.get('.gitifact/spec/posts').people), expected(f, 'HEAD', '.gitifact/spec/posts'));
  assert.deepEqual(shape(folders.get('.gitifact/instructions/rules').people), expected(f, 'HEAD', '.gitifact/instructions/rules'));
  await cache.history.ensure(head); calls();

  // The same HEAD asks Git nothing, in this process or a new one.
  await cache.log.contributors(head); assert.equal(calls(), 0);
  const again = counted(f.repo); await again.cache.log.contributors(head); await again.cache.history.ensure(head); assert.equal(again.calls(), 0);

  // A new commit is read as the difference: its own commits and nothing it shares with the HEAD before.
  d.feature('tags', S2); f.git(['add', '-A']); as(f, 'Carol', 'tags');
  head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.deepEqual(shape(await cache.log.contributors(head)), expected(f));
  assert.deepEqual(shape((await cache.log.folders(head)).get('.gitifact/spec/tags').people), [['carol@example.invalid', 'Carol', 1]]);

  // A branch, then back: each HEAD counts only its own commits.
  f.git(['checkout', '-q', '-b', 'side']); f.write('side.js', '1'); f.git(['add', '-A']); as(f, 'Dan', 'side'); as(f, 'Dan', 'side 2');
  const side = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.deepEqual(shape(await cache.log.contributors(side)), expected(f));
  f.git(['checkout', '-q', 'main']);
  assert.deepEqual(shape(await cache.log.contributors(head)), expected(f));
  assert.equal((await cache.log.contributors(head)).some(p => p.name === 'Dan'), false);

  // A reset takes commits away.
  f.git(['reset', '-q', '--hard', 'HEAD~1']);
  head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.deepEqual(shape(await cache.log.contributors(head)), expected(f));
  assert.equal((await cache.log.folders(head)).has('.gitifact/spec/tags'), false);

  // A .mailmap names people anew without a new HEAD.
  writeFileSync(join(f.repo, '.mailmap'), 'Annie <ann@example.invalid>\n');
  const renamed = await cache.log.contributors(head);
  assert.deepEqual(shape(renamed), expected(f));
  assert.ok(renamed.some(p => p.name === 'Annie'));

  // A format migration is nobody's work.
  as(f, 'Maintainer', 'Move\n\nGitifact-Migration: 0.8.0');
  head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.equal((await cache.log.contributors(head)).some(p => p.name === 'Maintainer'), false);
  assert.deepEqual(shape(await cache.log.contributors(head)), expected(f));
});

test('the log follows a HEAD that shares nothing with the one before', async t => {
  const { f, d } = await adopted(t);
  d.feature('posts', S); f.git(['add', '-A']); as(f, 'Ann', 'posts'); as(f, 'Bob', 'more');
  const { cache } = counted(f.repo);
  await cache.log.contributors(f.git(['rev-parse', 'HEAD']).stdout.trim());
  // An orphan branch shares nothing; the HEAD before is not its ancestor.
  f.git(['checkout', '-q', '--orphan', 'fresh']); f.git(['add', '-A']); as(f, 'Eve', 'fresh');
  const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
  assert.deepEqual(shape(await cache.log.contributors(head)), [['eve@example.invalid', 'Eve', 1]]);
});
