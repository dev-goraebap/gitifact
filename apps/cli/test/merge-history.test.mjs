import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { specFixture, fingerprint } from './git-fixture.mjs';
import { openRecords } from './browser-records.mjs';

const path = '.gitifact/spec/posts/requirements.md';
const wiki = '.gitifact/wiki/guide.md';
const design = '.gitifact/spec/posts/design.md';
const rid = 'R-aaaaaaaaaa'; const other = 'R-bbbbbbbbbb'; const wid = 'W-aaaaaaaaaa'; const sid = 'S-aaaaaaaaaa';
const spec = (a = 'Original', b = 'Unchanged') => `---\nid: ${sid}\n---\n\n# Posts\n\n## Save\n<!-- gitifact-req: ${rid} -->\n\n${a}\n\n## Read\n<!-- gitifact-req: ${other} -->\n\n${b}\n`;
const page = body => `---\nid: ${wid}\n---\n\n# Guide\n\n${body}\n`;
const plan = body => `---\nid: ${sid}\n---\n\n# Design\n\n${body}\n`;
function setup(t, format) {
  const f = specFixture(t, format);
  mkdirSync(join(f.repo, '.gitifact/spec/posts'), { recursive: true });
  mkdirSync(join(f.repo, '.gitifact/wiki'), { recursive: true });
  f.write(path, spec()); f.write(wiki, page('Original')); f.write(design, plan('Original')); f.commit('Base');
  const head = () => f.git(['rev-parse', 'HEAD']).stdout.trim();
  const commit = (name, message) => {
    f.git(['add', '-A']); f.git(['commit', '-m', message, '--author', `${name} <${name}@example.invalid>`]); return head();
  };
  const merge = (branch, message = 'Merge') => { f.git(['merge', '--no-ff', branch, '-m', message]); return head(); };
  return { ...f, head, commit, merge };
}
const project = f => {
  const all = fingerprint(f.repo);
  for (const key of Object.keys(all)) if (key.startsWith('.git/gitifact')) delete all[key];
  return all;
};

for (const format of ['sha1', 'sha256']) test(`merged wiki, design and requirements keep original authors, reasons and keys (${format})`, async t => {
  const f = setup(t, format);
  f.git(['switch', '-c', 'work']);
  f.write(path, spec('Sujeong change')); f.write(wiki, page('Sujeong guide')); f.write(design, plan('Sujeong design'));
  f.write('.gitifact/spec/posts/history.jsonl', JSON.stringify({ id: 'H-aaaaaaaaaa', requirements: [rid], designs: [sid], reason: 'Original reason' }) + '\n');
  f.write('.gitifact/wiki/history.jsonl', JSON.stringify({ id: 'H-bbbbbbbbbb', requirements: [], documents: [wid], reason: 'Guide reason' }) + '\n');
  const original = f.commit('Sujeong', 'Original work');
  f.git(['switch', 'main']); f.write('code.txt', 'unrelated'); f.commit('Maintainer', 'Main code');
  // A contributor updates her branch from main before the maintainer merges it back.
  f.git(['switch', 'work']); const sync = f.merge('main', 'Sync main');
  f.git(['switch', 'main']); const merge = f.merge('work');
  const before = project(f); const read = openRecords(f.repo, f.env);
  const result = await read();
  assert.equal(result.events.some(e => [merge, sync].includes(e.commit)), false);
  const edits = result.events.filter(e => e.commit === original);
  assert.deepEqual(edits.map(e => e.id).sort(), [rid, sid, wid].sort());
  assert.ok(edits.every(e => e.author === 'Sujeong' && e.email === 'Sujeong@example.invalid'));
  assert.deepEqual(edits.find(e => e.id === wid).reasons, ['Guide reason']);
  assert.deepEqual(edits.find(e => e.id === rid).reasons, ['Original reason']);
  assert.equal((await read.history.page(merge, { author: 'Sujeong@example.invalid' }, 0, 50)).total, 3);
  assert.equal((await read.history.summary(merge)).recent[0].commit, original);
  assert.equal((await read.history.search('unused', merge, 'Guide reason'))[0].key, original + ':' + wid);
  assert.equal((await read.change(original + ':' + rid)).after.body, 'Sujeong change');
  assert.equal(await read.change(merge + ':' + rid), undefined);
  assert.deepEqual(project(f), before);
  // Upgrade a real cache carrying the old merger attribution. A new reader must replace it, not reuse its rows.
  const db = new DatabaseSync(join(f.repo, '.git/gitifact/index.sqlite'));
  db.exec("UPDATE changes SET email = 'wrong@example.invalid'; PRAGMA user_version = 1"); db.close();
  const fresh = openRecords(f.repo, f.env).history;
  assert.equal((await fresh.page(merge, { author: 'Sujeong@example.invalid' }, 0, 50)).total, 3);
  assert.equal((await fresh.page(merge, { author: 'wrong@example.invalid' }, 0, 50)).total, 0);
});

test('automatic combinations within one requirement are not attributed to the merger', async t => {
  const f = setup(t); const body = (first, last) => [first, ...Array.from({ length: 12 }, (_, i) => 'Context ' + i), last].join('\n');
  f.write(path, spec(body('Top', 'Bottom'))); f.commit('Base', 'Long requirement');
  f.git(['switch', '-c', 'work']); f.write(path, spec(body('Changed top', 'Bottom'))); const a = f.commit('Ann', 'Top edit');
  f.git(['switch', 'main']); f.write(path, spec(body('Top', 'Changed bottom'))); const b = f.commit('Bob', 'Bottom edit');
  const merge = f.merge('work'); const before = project(f);
  const result = await openRecords(f.repo, f.env)();
  assert.equal(result.events.some(e => e.commit === merge), false);
  assert.equal(result.events.filter(e => [a, b].includes(e.commit)).length, 2);
  assert.deepEqual(project(f), before);
});

test('merge conflict resolutions keep the merger but do not steal clean changes in the same file', async t => {
  const f = setup(t);
  f.git(['switch', '-c', 'work']); f.write(path, spec('Branch value', 'Branch reader')); f.write(wiki, page('Branch guide'));
  const work = f.commit('Sujeong', 'Branch work');
  f.git(['switch', 'main']); f.write(path, spec('Main value')); f.commit('Bob', 'Main work');
  assert.equal(f.git(['merge', '--no-ff', 'work'], f.repo, true).status, 1);
  f.write(path, spec('Resolved value', 'Branch reader'));
  f.write('.gitifact/spec/posts/history.jsonl', JSON.stringify({ id: 'H-cccccccccc', requirements: [rid], reason: 'Resolve different policies' }) + '\n');
  const merge = f.commit('Maintainer', 'Resolve conflict'); const before = project(f);
  const read = openRecords(f.repo, f.env); const result = await read();
  const resolutions = result.events.filter(e => e.commit === merge);
  assert.deepEqual(resolutions.map(e => e.id), [rid]);
  assert.equal(resolutions[0].author, 'Maintainer'); assert.deepEqual(resolutions[0].reasons, ['Resolve different policies']);
  const change = await read.change(merge + ':' + rid);
  assert.equal(change.before.body, 'Main value'); assert.equal(change.after.body, 'Resolved value');
  assert.equal(result.events.find(e => e.commit === work && e.id === wid).author, 'Sujeong');
  assert.deepEqual(project(f), before);
});

test('edits made during a clean merge are retained, while branch moves and deletions appear once', async t => {
  const f = setup(t);
  f.git(['switch', '-c', 'work']);
  f.git(['mv', wiki, '.gitifact/wiki/moved.md']); f.git(['rm', design]);
  f.write(path, spec('Branch value')); const work = f.commit('Sujeong', 'Move and remove');
  f.git(['switch', 'main']); f.write('code.txt', 'code'); f.commit('Bob', 'Code');
  f.git(['merge', '--no-ff', '--no-commit', 'work']);
  f.write('.gitifact/wiki/moved.md', page('Edited during merge'));
  const merge = f.commit('Maintainer', 'Merge with edit');
  const result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => e.id), [wid]);
  assert.ok(result.events.find(e => e.commit === work && e.id === wid).types.includes('moved'));
  assert.deepEqual(result.events.find(e => e.commit === work && e.id === sid).types, ['deleted']);
});

test('fast-forward and squash use the authors actually recorded in Git', async t => {
  const f = setup(t); f.git(['switch', '-c', 'work']); f.write(wiki, page('Work'));
  const work = f.commit('Sujeong', 'Work'); f.git(['switch', 'main']); f.git(['merge', '--ff-only', 'work']);
  let result = await openRecords(f.repo, f.env)();
  assert.equal(result.events[0].commit, work); assert.equal(result.events[0].author, 'Sujeong');
  f.git(['switch', '-c', 'squash']); f.write(wiki, page('Squashed')); const unreachable = f.commit('Someone', 'Branch');
  f.git(['switch', 'main']); f.git(['merge', '--squash', 'squash']); const squash = f.commit('SquashAuthor', 'Squash');
  result = await openRecords(f.repo, f.env)();
  assert.equal(result.events[0].commit, squash); assert.equal(result.events[0].author, 'SquashAuthor');
  assert.equal(result.events.some(e => e.commit === unreachable), false);
});

test('a merged branch that undoes its own change retains both original commits and reasons', async t => {
  const f = setup(t); f.git(['switch', '-c', 'work']);
  const reason = (id, text) => JSON.stringify({ id, requirements: [rid], reason: text }) + '\n';
  const firstReason = reason('H-aaaaaaaaaa', 'Try a policy');
  f.write(path, spec('Temporary'));
  f.write('.gitifact/spec/posts/history.jsonl', firstReason); const first = f.commit('Ann', 'Try');
  f.write(path, spec());
  f.write('.gitifact/spec/posts/history.jsonl', firstReason + reason('H-bbbbbbbbbb', 'Restore the policy'));
  const second = f.commit('Bob', 'Restore');
  f.git(['switch', 'main']); const merge = f.merge('work');
  const result = await openRecords(f.repo, f.env)();
  assert.equal(result.events.some(e => e.commit === merge), false);
  assert.deepEqual(result.events.filter(e => [first, second].includes(e.commit)).map(e => [e.author, e.reasons]),
    [['Bob', ['Restore the policy']], ['Ann', ['Try a policy']]]);
});

test('requirements deleted during merge and new octopus content remain visible', async t => {
  const f = setup(t); f.git(['switch', '-c', 'one']); f.write(wiki, page('Branch guide')); f.commit('Ann', 'Guide');
  f.git(['switch', 'main']); f.git(['switch', '-c', 'two']); f.write(design, plan('Branch design')); f.commit('Bob', 'Design');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'one', 'two']);
  f.write(path, spec('New octopus policy')); const octopus = f.commit('Maintainer', 'Octopus with edit');
  let result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === octopus).map(e => e.id), [rid]);
  f.git(['switch', '-c', 'remove']); f.write(wiki, page('Another guide')); f.commit('Ann', 'Guide again');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'remove']);
  f.write(path, spec('New octopus policy').split('\n## Read')[0] + '\n');
  const merge = f.commit('Maintainer', 'Delete requirement during merge');
  result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => [e.id, e.types]), [[other, ['deleted']]]);
});

test('merge edits in CRLF files and quoted frontmatter keep their record identity', async t => {
  const f = setup(t);
  const format = text => text.replace(/id: (\S+)/, 'id: "$1"').replace(/\n/g, '\r\n');
  f.write(path, format(spec())); f.write(wiki, format(page('Original'))); f.commit('Base', 'CRLF and quoted IDs');
  f.git(['switch', '-c', 'work']); f.write(design, plan('Branch design')); f.commit('Ann', 'Branch');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'work']);
  f.write(path, format(spec('Merge policy'))); f.write(wiki, format(page('Merge guide')));
  const merge = f.commit('Maintainer', 'Merge edits');
  const result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => e.id).sort(), [rid, wid]);
});
