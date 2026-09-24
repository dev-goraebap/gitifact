import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { specFixture } from './git-fixture.mjs';
import { openRecords, docs, reasonsOf } from './browser-records.mjs';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';

const S = 'S-aaaaaaaaaa', R = 'R-aaaaaaaaaa', W = 'W-aaaaaaaaaa';
// The 0.7 layout: one requirements.md per feature with ID comments, and a reason file per folder.
const oldSpec = body => `---\nid: ${S}\n---\n\n# Posts\n\n## Save\n<!-- gitifact-req: ${R} -->\n\n${body}\n`;
const oldPage = body => `---\nid: ${W}\n---\n\n# Guide\n\n${body}\n`;
const oldReason = (id, reason, documents) => JSON.stringify(documents ? { id, requirements: [], documents, reason } : { id, requirements: [R], reason }) + '\n';

function project(t) {
  const f = specFixture(t); const d = docs(f);
  const commit = (name, message) => { f.git(['add', '-A']); f.git(['commit', '-m', message, '--author', `${name} <${name}@example.invalid>`]); return f.git(['rev-parse', 'HEAD']).stdout.trim(); };
  return { f, d, commit };
}

test('0.7 activity stays in the history after a migration, the migration itself is hidden, and a requirement runs on across it', async t => {
  const { f, d, commit } = project(t);
  d.put('.gitifact/spec/posts/requirements.md', oldSpec('First')); d.put('.gitifact/spec/posts/history.jsonl', oldReason('H-aaaaaaaaaa', 'Start posts'));
  d.put('.gitifact/wiki/guide.md', oldPage('Read me')); d.put('.gitifact/wiki/history.jsonl', oldReason('H-bbbbbbbbbb', 'Write the guide', [W]));
  const ann = commit('Ann', 'Posts');
  d.put('.gitifact/spec/posts/requirements.md', oldSpec('Second'));
  d.put('.gitifact/spec/posts/history.jsonl', oldReason('H-aaaaaaaaaa', 'Start posts') + oldReason('H-cccccccccc', 'Say more'));
  const bob = commit('Bob', 'Refine');
  // A cache built before the migration reads these commits as the current format and finds nothing in them.
  const early = openRecords(f.repo, f.env);
  assert.equal((await early.history.page(bob, {}, 0, 50)).total, 0);

  // The migration: the old files go, the new ones keep the IDs, the wiki page becomes an instruction, and the commit carries the trailer.
  rmSync(join(f.repo, '.gitifact/wiki'), { recursive: true });
  for (const path of ['.gitifact/spec/posts/requirements.md', '.gitifact/spec/posts/history.jsonl']) rmSync(join(f.repo, path));
  d.feature('posts', S, { title: 'Posts' }); d.requirement('posts', 'save', R, { title: 'Save', body: 'Second' }); d.instruction('guide', 'I-aaaaaaaaaa', { title: 'Guide', body: 'Read me' });
  f.git(['add', '-A']); f.git(['commit', '-m', 'Move records to 0.8.0\n\nGitifact-Migration: 0.8.0', '--author', 'Maintainer <maintainer@example.invalid>']);
  const migration = f.git(['rev-parse', 'HEAD']).stdout.trim();
  d.requirement('posts', 'save', R, { title: 'Save', body: 'Third' }); d.reasons({ id: 'H-dddddddddd', docs: [R], reason: 'After the move' });
  const carol = commit('Carol', 'Refine again');

  const read = openRecords(f.repo, f.env); const result = await read();
  assert.equal(result.events.some(e => e.commit === migration), false);
  assert.deepEqual(result.events.map(e => [e.author, e.id, e.types, reasonsOf(e)]), [
    ['Carol', R, ['modified'], ['After the move']],
    ['Bob', R, ['modified'], ['Say more']],
    ['Ann', R, ['created'], ['Start posts']],
    ['Ann', W, ['created'], ['Write the guide']],
  ]);
  // The requirement's own history crosses the migration, and a 0.7 change opens with its text on both sides.
  assert.deepEqual((await read.history.ofDocument(carol, R)).map(e => e.commit), [carol, bob, ann]);
  const legacy = await read.change(bob + ':' + R);
  assert.deepEqual([legacy.before.body, legacy.after.body, legacy.after.kind, legacy.after.specId], ['First', 'Second', 'requirement', S]);
  // The same cache that read these commits before the migration reads them again with the 0.7 parser.
  assert.equal((await early.history.page(carol, {}, 0, 50)).total, 4);
  // Authors and dates leave the migration out: the maintainer did not write these documents.
  assert.deepEqual(result.features[0].contributors.map(p => p.name).sort(), ['Ann', 'Bob', 'Carol']);
  assert.equal(result.contributors.some(p => p.name === 'Maintainer'), false);
});

test('without a migration commit every commit is read as the current format', async t => {
  const { f, d, commit } = project(t);
  d.put('.gitifact/spec/posts/requirements.md', oldSpec('First')); commit('Ann', 'Old');
  d.feature('posts', S); d.requirement('posts', 'save', R); rmSync(join(f.repo, '.gitifact/spec/posts/requirements.md'));
  const plain = commit('Bob', 'Moved without the trailer');
  const result = await openRecords(f.repo, f.env)();
  // Nothing marks the old commit as 0.7, so it is not read with the old parser; the move reads as creation.
  assert.deepEqual(result.events.map(e => [e.commit, e.id, e.types]), [[plain, R, ['created']], [plain, S, ['created']]]);
});

test('0.7 trees are read in one batch: every asked commit comes back and an unreadable one is left out', async t => {
  const { f, d, commit } = project(t);
  d.put('.gitifact/spec/posts/requirements.md', oldSpec('First')); const ann = commit('Ann', 'Posts');
  d.put('.gitifact/spec/posts/requirements.md', oldSpec('Second')); const bob = commit('Bob', 'Refine');
  // A commit whose tree the 0.7 parser refuses stands for the half-written states history may hold.
  d.put('.gitifact/spec/posts/requirements.md', 'no frontmatter\n'); const broken = commit('Carol', 'Broken');
  const reader = storeReader(f.repo);
  const bundles = await reader.readBundles([ann, bob, broken, '0'.repeat(40)]);
  assert.deepEqual([...bundles.keys()].sort(), [ann, bob].sort());
  // Trees are listed concurrently, so the map's order is not the asked order; callers look bundles up by commit.
  assert.deepEqual([ann, bob].map(oid => bundles.get(oid).specs[0].requirements[0].body), ['First', 'Second']);
  // The same blob is read once however many commits name it.
  const trees = await Promise.all([ann, bob].map(oid => reader.tree(oid)));
  assert.notEqual(trees[0].get('.gitifact/spec/posts/requirements.md'), trees[1].get('.gitifact/spec/posts/requirements.md'));
});
