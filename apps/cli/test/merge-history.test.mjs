import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { renderDocumentFile, renderReasonLine } from '@gitifact/core';
import { specFixture, fingerprint } from './git-fixture.mjs';
import { openRecords, docs, reasonsOf } from './browser-records.mjs';

const save = '.gitifact/spec/posts/requirements/save.md';
const read = '.gitifact/spec/posts/requirements/read.md';
const wiki = '.gitifact/wiki/guide.md';
const design = '.gitifact/spec/posts/design/overview.md';
const history = '.gitifact/history.jsonl';
const rid = 'R-aaaaaaaaaa'; const other = 'R-bbbbbbbbbb'; const wid = 'W-aaaaaaaaaa'; const sid = 'S-aaaaaaaaaa'; const did = 'D-aaaaaaaaaa';
const requirement = (path, id, title, body) => renderDocumentFile({ kind: 'requirement', path, id, title, description: title, body, feature: 'posts', order: id === rid ? 10 : 20 });
const saveText = (body = 'Original') => requirement(save, rid, 'Save', body);
const readText = (body = 'Unchanged') => requirement(read, other, 'Read', body);
const page = body => renderDocumentFile({ kind: 'wiki', path: wiki, id: wid, title: 'Guide', description: 'Guide', body });
const plan = body => renderDocumentFile({ kind: 'design', path: design, id: did, title: 'Design', description: 'Design', body, feature: 'posts', order: 10, requirements: [], sources: [] });
const reasons = (...lines) => lines.map(l => renderReasonLine(l) + '\n').join('');
function setup(t, format) {
  const f = specFixture(t, format); docs(f).feature('posts', sid, { title: 'Posts' });
  const put = docs(f).put;
  put(save, saveText()); put(read, readText()); put(wiki, page('Original')); put(design, plan('Original')); f.commit('Base');
  const head = () => f.git(['rev-parse', 'HEAD']).stdout.trim();
  const commit = (name, message) => {
    f.git(['add', '-A']); f.git(['commit', '-m', message, '--author', `${name} <${name}@example.invalid>`]); return head();
  };
  const merge = (branch, message = 'Merge') => { f.git(['merge', '--no-ff', branch, '-m', message]); return head(); };
  return { ...f, put, head, commit, merge };
}
const project = f => {
  const all = fingerprint(f.repo);
  for (const key of Object.keys(all)) if (key.startsWith('.gitifact/cache')) delete all[key];
  return all;
};

for (const format of ['sha1', 'sha256']) test(`merged wiki, design and requirements keep original authors, reasons and keys (${format})`, async t => {
  const f = setup(t, format);
  f.git(['switch', '-c', 'work']);
  f.put(save, saveText('Sujeong change')); f.put(wiki, page('Sujeong guide')); f.put(design, plan('Sujeong design'));
  f.put(history, reasons({ id: 'H-aaaaaaaaaa', docs: [rid, did], reason: 'Original reason' }, { id: 'H-bbbbbbbbbb', docs: [wid], reason: 'Guide reason' }));
  const original = f.commit('Sujeong', 'Original work');
  f.git(['switch', 'main']); f.write('code.txt', 'unrelated'); f.commit('Maintainer', 'Main code');
  // A contributor updates her branch from main before the maintainer merges it back.
  f.git(['switch', 'work']); const sync = f.merge('main', 'Sync main');
  f.git(['switch', 'main']); const merge = f.merge('work');
  const before = project(f); const records = openRecords(f.repo, f.env);
  const result = await records();
  assert.equal(result.events.some(e => [merge, sync].includes(e.commit)), false);
  const edits = result.events.filter(e => e.commit === original);
  assert.deepEqual(edits.map(e => e.id).sort(), [did, rid, wid].sort());
  assert.ok(edits.every(e => e.author === 'Sujeong' && e.email === 'Sujeong@example.invalid'));
  assert.deepEqual(reasonsOf(edits.find(e => e.id === wid)), ['Guide reason']);
  assert.deepEqual(reasonsOf(edits.find(e => e.id === rid)), ['Original reason']);
  assert.equal((await records.history.commits(merge, { author: 'Sujeong@example.invalid' }, undefined, 50)).total, 3);
  assert.equal((await records.history.summary(merge)).recent[0].commit, original);
  assert.equal((await records.cache.history.searchRecords(merge, 'Guide reason', undefined, 5)).hits[0].commit, original);
  assert.equal((await records.change(original + ':' + rid)).after.body, 'Sujeong change');
  assert.equal(await records.change(merge + ':' + rid), undefined);
  assert.deepEqual(project(f), before);
  // A cache carrying wrong rows under another format number is replaced, not reused.
  const db = new DatabaseSync(join(f.repo, '.gitifact/cache/index.db'));
  db.exec("UPDATE changes SET email = 'wrong@example.invalid'; PRAGMA user_version = 0"); db.close();
  const fresh = openRecords(f.repo, f.env).history;
  assert.equal((await fresh.commits(merge, { author: 'Sujeong@example.invalid' }, undefined, 50)).total, 3);
  assert.equal((await fresh.commits(merge, { author: 'wrong@example.invalid' }, undefined, 50)).total, 0);
});

test('automatic combinations within one requirement are not attributed to the merger', async t => {
  const f = setup(t); const body = (first, last) => [first, ...Array.from({ length: 12 }, (_, i) => 'Context ' + i), last].join('\n');
  f.put(save, saveText(body('Top', 'Bottom'))); f.commit('Base', 'Long requirement');
  f.git(['switch', '-c', 'work']); f.put(save, saveText(body('Changed top', 'Bottom'))); const a = f.commit('Ann', 'Top edit');
  f.git(['switch', 'main']); f.put(save, saveText(body('Top', 'Changed bottom'))); const b = f.commit('Bob', 'Bottom edit');
  const merge = f.merge('work'); const before = project(f);
  const result = await openRecords(f.repo, f.env)();
  assert.equal(result.events.some(e => e.commit === merge), false);
  assert.equal(result.events.filter(e => [a, b].includes(e.commit)).length, 2);
  assert.deepEqual(project(f), before);
});

test('merge conflict resolutions keep the merger but do not steal clean changes of other documents', async t => {
  const f = setup(t);
  f.git(['switch', '-c', 'work']); f.put(save, saveText('Branch value')); f.put(read, readText('Branch reader')); f.put(wiki, page('Branch guide'));
  const work = f.commit('Sujeong', 'Branch work');
  f.git(['switch', 'main']); f.put(save, saveText('Main value')); f.commit('Bob', 'Main work');
  assert.equal(f.git(['merge', '--no-ff', 'work'], f.repo, true).status, 1);
  f.put(save, saveText('Resolved value'));
  f.put(history, reasons({ id: 'H-cccccccccc', docs: [rid], reason: 'Resolve different policies' }));
  const merge = f.commit('Maintainer', 'Resolve conflict'); const before = project(f);
  const records = openRecords(f.repo, f.env); const result = await records();
  const resolutions = result.events.filter(e => e.commit === merge);
  assert.deepEqual(resolutions.map(e => e.id), [rid]);
  assert.equal(resolutions[0].author, 'Maintainer'); assert.deepEqual(reasonsOf(resolutions[0]), ['Resolve different policies']);
  const change = await records.change(merge + ':' + rid);
  assert.equal(change.before.body, 'Main value'); assert.equal(change.after.body, 'Resolved value');
  assert.equal(result.events.find(e => e.commit === work && e.id === wid).author, 'Sujeong');
  assert.equal(result.events.find(e => e.commit === work && e.id === other).author, 'Sujeong');
  assert.deepEqual(project(f), before);
});

test('edits made during a clean merge are retained, while branch moves and deletions appear once', async t => {
  const f = setup(t);
  f.git(['switch', '-c', 'work']);
  f.git(['mv', wiki, '.gitifact/wiki/moved.md']); f.git(['rm', '-q', design]);
  f.put(save, saveText('Branch value')); const work = f.commit('Sujeong', 'Move and remove');
  f.git(['switch', 'main']); f.write('code.txt', 'code'); f.commit('Bob', 'Code');
  f.git(['merge', '--no-ff', '--no-commit', 'work']);
  f.put('.gitifact/wiki/moved.md', page('Edited during merge'));
  const merge = f.commit('Maintainer', 'Merge with edit');
  const result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => e.id), [wid]);
  assert.ok(result.events.find(e => e.commit === work && e.id === wid).types.includes('moved'));
  assert.deepEqual(result.events.find(e => e.commit === work && e.id === did).types, ['deleted']);
});

test('fast-forward and squash use the authors actually recorded in Git', async t => {
  const f = setup(t); f.git(['switch', '-c', 'work']); f.put(wiki, page('Work'));
  const work = f.commit('Sujeong', 'Work'); f.git(['switch', 'main']); f.git(['merge', '--ff-only', 'work']);
  let result = await openRecords(f.repo, f.env)();
  assert.equal(result.events[0].commit, work); assert.equal(result.events[0].author, 'Sujeong');
  f.git(['switch', '-c', 'squash']); f.put(wiki, page('Squashed')); const unreachable = f.commit('Someone', 'Branch');
  f.git(['switch', 'main']); f.git(['merge', '--squash', 'squash']); const squash = f.commit('SquashAuthor', 'Squash');
  result = await openRecords(f.repo, f.env)();
  assert.equal(result.events[0].commit, squash); assert.equal(result.events[0].author, 'SquashAuthor');
  assert.equal(result.events.some(e => e.commit === unreachable), false);
});

test('a merged branch that undoes its own change retains both original commits and reasons', async t => {
  const f = setup(t); f.git(['switch', '-c', 'work']);
  const firstReason = { id: 'H-aaaaaaaaaa', docs: [rid], reason: 'Try a policy' };
  f.put(save, saveText('Temporary'));
  f.put(history, reasons(firstReason)); const first = f.commit('Ann', 'Try');
  f.put(save, saveText());
  f.put(history, reasons(firstReason, { id: 'H-bbbbbbbbbb', docs: [rid], reason: 'Restore the policy' }));
  const second = f.commit('Bob', 'Restore');
  f.git(['switch', 'main']); const merge = f.merge('work');
  const result = await openRecords(f.repo, f.env)();
  assert.equal(result.events.some(e => e.commit === merge), false);
  assert.deepEqual(result.events.filter(e => [first, second].includes(e.commit)).map(e => [e.author, reasonsOf(e)]),
    [['Bob', ['Restore the policy']], ['Ann', ['Try a policy']]]);
});

test('requirements deleted during merge and new octopus content remain visible', async t => {
  const f = setup(t); f.git(['switch', '-c', 'one']); f.put(wiki, page('Branch guide')); f.commit('Ann', 'Guide');
  f.git(['switch', 'main']); f.git(['switch', '-c', 'two']); f.put(design, plan('Branch design')); f.commit('Bob', 'Design');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'one', 'two']);
  f.put(save, saveText('New octopus policy')); const octopus = f.commit('Maintainer', 'Octopus with edit');
  let result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === octopus).map(e => e.id), [rid]);
  f.git(['switch', '-c', 'remove']); f.put(wiki, page('Another guide')); f.commit('Ann', 'Guide again');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'remove']);
  f.git(['rm', '-q', read]);
  const merge = f.commit('Maintainer', 'Delete requirement during merge');
  result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => [e.id, e.types]), [[other, ['deleted']]]);
});

test('merge edits in CRLF files and quoted frontmatter keep their document identity', async t => {
  const f = setup(t);
  const format = text => text.replace(/id: (\S+)/, 'id: "$1"').replace(/\n/g, '\r\n');
  f.put(save, format(saveText())); f.put(wiki, format(page('Original'))); f.commit('Base', 'CRLF and quoted IDs');
  f.git(['switch', '-c', 'work']); f.put(design, plan('Branch design')); f.commit('Ann', 'Branch');
  f.git(['switch', 'main']); f.git(['merge', '--no-ff', '--no-commit', 'work']);
  f.put(save, format(saveText('Merge policy'))); f.put(wiki, format(page('Merge guide')));
  const merge = f.commit('Maintainer', 'Merge edits');
  const result = await openRecords(f.repo, f.env)();
  assert.deepEqual(result.events.filter(e => e.commit === merge).map(e => e.id).sort(), [rid, wid]);
});

test('reasons added on two branches merge without conflict under the union rule and stay with their commits', async t => {
  const f = setup(t);
  f.put('.gitattributes', '/.gitifact/history.jsonl merge=union\n'); f.put(history, reasons({ id: 'H-aaaaaaaaaa', docs: [rid], reason: 'Base reason' })); f.commit('Base', 'Rule');
  f.git(['switch', '-c', 'work']); f.put(wiki, page('Branch guide'));
  f.put(history, reasons({ id: 'H-aaaaaaaaaa', docs: [rid], reason: 'Base reason' }, { id: 'H-bbbbbbbbbb', docs: [wid], reason: 'Guide on the branch' }));
  const work = f.commit('Ann', 'Branch');
  f.git(['switch', 'main']); f.put(save, saveText('Main value'));
  f.put(history, reasons({ id: 'H-aaaaaaaaaa', docs: [rid], reason: 'Base reason' }, { id: 'H-cccccccccc', docs: [rid], reason: 'Save on main' }));
  const main = f.commit('Bob', 'Main');
  const merge = f.merge('work');
  // Both appended lines are kept by Git, and the merge itself changed no document.
  assert.equal(f.git(['show', 'HEAD:' + history]).stdout.trim().split('\n').length, 3);
  const result = await openRecords(f.repo, f.env)();
  assert.equal(result.events.some(e => e.commit === merge), false);
  assert.deepEqual(reasonsOf(result.events.find(e => e.commit === work && e.id === wid)), ['Guide on the branch']);
  assert.deepEqual(reasonsOf(result.events.find(e => e.commit === main && e.id === rid)), ['Save on main']);
});

test('records added on branches stay with their commits; a record the merge itself adds belongs to the merge', async t => {
  const f = setup(t); const d = docs(f);
  f.git(['switch', '-c', 'work']); f.put(save, saveText('Branch value'));
  d.record({ id: 'DR-aaaaaaaaaa', docs: [rid], title: 'Keep drafts on the server', reason: 'Drafts must survive a reload.' });
  const work = f.commit('Ann', 'Branch');
  f.git(['switch', 'main']); f.put(read, readText('Main reader'));
  d.record({ id: 'DR-bbbbbbbbbb', docs: [other], reason: 'Readers wanted the unread count.' });
  const main = f.commit('Bob', 'Main');
  // The merge resolves nothing by itself but edits the requirement and writes why.
  f.git(['merge', '--no-ff', '--no-commit', 'work']); f.put(save, saveText('Merged value'));
  d.record({ id: 'DR-cccccccccc', docs: [rid], reason: 'Both policies apply after the merge.' });
  f.git(['add', '-A']); f.git(['commit', '-m', 'Merge work', '--author', 'Maintainer <Maintainer@example.invalid>']); const merge = f.head();
  const result = await openRecords(f.repo, f.env)();
  const on = (commit, id) => result.events.find(e => e.commit === commit && e.id === id).records;
  assert.deepEqual(on(work, rid).map(r => [r.id, r.title, r.sections]), [['DR-aaaaaaaaaa', 'Keep drafts on the server',
    [{ key: 'context', body: 'Drafts must survive a reload.' }, { key: 'decision', body: 'Keep drafts on the server' }]]]);
  assert.deepEqual(on(main, other).map(r => r.id), ['DR-bbbbbbbbbb']);
  assert.deepEqual(on(merge, rid).map(r => r.id), ['DR-cccccccccc']);
  // A record is found by what it says.
  const records = openRecords(f.repo, f.env);
  assert.deepEqual((await records.cache.history.searchRecords(merge, 'survive a reload', undefined, 5)).hits.map(h => [h.id, h.commit]), [['DR-aaaaaaaaaa', work]]);
});
