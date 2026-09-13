import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeProject } from '../.test-build/commands/init.js';
import { noteCommand } from '../.test-build/commands/note.js';
import { notesV1 } from '@tryce/contracts';
import { fixture, fingerprint } from './git-fixture.mjs';

const configPath = f => join(f.repo, '.tryce/config.json');
const call = (f, action, options = {}, id, controls, cwd = f.repo) => noteCommand(cwd, action, options, id, f.env, controls);
const setup = async (t, mode = 'prototype') => { const f = fixture(t); await initializeProject(f.repo, { mode }, f.env); return f; };
const add = (f, message, extra = {}, controls) => call(f, 'add', { type: 'discovery', message, ...extra }, undefined, controls);
const preserved = (before, after, except = []) => {
  for (const [key, value] of Object.entries(before)) if (!except.includes(key)) assert.equal(after[key], value, key);
};

test('enable plans without writes, preserves exact config backup and does not change baseline or mode', async t => {
  const f = await setup(t); const original = readFileSync(configPath(f)); const before = fingerprint(f.repo);
  await assert.rejects(add(f, 'before enable'), { code: 'NOTES_NOT_ENABLED' });
  const plan = notesV1.parse(await call(f, 'enable', { dryRun: true }));
  assert.equal(plan.outcome, 'planned'); assert.deepEqual(fingerprint(f.repo), before);
  const enabled = await call(f, 'enable');
  assert.equal(enabled.outcome, 'enabled'); assert.deepEqual(readFileSync(join(f.repo, enabled.backupPath)), original);
  const config = JSON.parse(readFileSync(configPath(f), 'utf8'));
  assert.deepEqual(config, { ...JSON.parse(original), format: 'prototype-1' });
  const after = fingerprint(f.repo);
  assert.equal((await call(f, 'enable')).outcome, 'already-enabled'); assert.deepEqual(fingerprint(f.repo), after);
  assert.equal((await initializeProject(f.repo, {}, f.env)).projectFormat, 'prototype-1');
  preserved(before, after, ['.tryce/config.json']);
});

test('append, list, show and corrections preserve originals, file input, partial staging and provenance', async t => {
  const f = await setup(t); await call(f, 'enable');
  f.write('user.txt', 'stage'); f.git(['add', 'user.txt']); f.write('user.txt', 'work');
  const before = fingerprint(f.repo);
  const first = (await add(f, '발견 🐳\n실제 근거', { author: 'Codex' })).notes[0];
  const original = readFileSync(join(f.repo, '.tryce/notes', first.id + '.json'));
  const source = join(f.root, 'body.txt'); writeFileSync(source, '제약을 수정한 이유\n두 번째 줄');
  const second = (await call(f, 'add', { type: 'constraint', file: source, ref: [first.id], supersedes: first.id })).notes[0];
  assert.equal(second.author, null); assert.equal(second.text, readFileSync(source, 'utf8'));
  const listed = notesV1.parse(await call(f, 'list')); assert.equal(listed.source, 'working-tree'); assert.equal(listed.notes.length, 2);
  assert.deepEqual((await call(f, 'show', {}, first.id)).notes, [first]);
  assert.deepEqual(readFileSync(join(f.repo, '.tryce/notes', first.id + '.json')), original);
  preserved(before, fingerprint(f.repo));
  await assert.rejects(add(f, 'missing', { ref: ['N-12345678-1234-4234-8234-123456789abc'] }), { code: 'NOTE_REFERENCE_MISSING' });
  await assert.rejects(call(f, 'show', {}, '../escape'), { code: 'INVALID_NOTE_ID' });
  await assert.rejects(add(f, 'collision', {}, { newId: () => first.id.slice(2) }), { code: 'NOTE_ID_CONFLICT' });
});

test('failure after backup resumes and input change never overwrites the changed config', async t => {
  const f = await setup(t); const original = readFileSync(configPath(f));
  await assert.rejects(call(f, 'enable', {}, undefined, { afterBackup: async () => { throw new Error('interrupted'); } }), /interrupted/);
  assert.deepEqual(readFileSync(configPath(f)), original);
  assert.equal(readdirSync(join(f.repo, '.tryce')).filter(name => name.startsWith('config.init-1.')).length, 1);
  assert.equal((await call(f, 'enable')).outcome, 'enabled');
  const changed = JSON.stringify({ ...JSON.parse(readFileSync(configPath(f), 'utf8')), mode: 'normal' });
  await assert.rejects(add(f, 'race', {}, { beforeWrite: async () => writeFileSync(configPath(f), changed) }), { code: 'INPUT_CHANGED' });
  assert.equal(readFileSync(configPath(f), 'utf8'), changed);
  assert.equal(existsSync(join(f.repo, '.tryce/.notes.lock')), false);
});

test('ignore, normal mode and unsupported format refuse writes', async t => {
  const f = await setup(t, 'normal'); const before = fingerprint(f.repo);
  await assert.rejects(call(f, 'enable'), { code: 'PROTOTYPE_REQUIRED' }); assert.deepEqual(fingerprint(f.repo), before);
  writeFileSync(configPath(f), JSON.stringify({ ...JSON.parse(readFileSync(configPath(f), 'utf8')), mode: 'prototype' }));
  f.write('.gitignore', '.tryce/config.init-1.*\n');
  await assert.rejects(call(f, 'enable'), { code: 'CONFIG_IGNORED' });
  f.write('.gitignore', ''); await call(f, 'enable');
  f.write('.gitignore', '.tryce/notes/\n'); await assert.rejects(add(f, 'ignored'), { code: 'CONFIG_IGNORED' });
  writeFileSync(configPath(f), '{"kind":"tryce-project","format":"future"}');
  await assert.rejects(call(f, 'list'), { code: 'UNSUPPORTED_FORMAT' });
});

test('corrupt, deleted and linked notes are not reported as an empty list', async t => {
  const f = await setup(t); await call(f, 'enable');
  const first = (await add(f, 'saved')).notes[0]; const path = join(f.repo, '.tryce/notes', first.id + '.json');
  const original = readFileSync(path); writeFileSync(path, '{');
  await assert.rejects(call(f, 'list'), { code: 'INVALID_NOTE' });
  writeFileSync(path, original); f.commit('records'); unlinkSync(path);
  await assert.rejects(call(f, 'list'), { code: 'NOTE_DELETED' }); await assert.rejects(add(f, 'another'), { code: 'NOTE_DELETED' });
  rmdirSync(join(f.repo, '.tryce/notes'));
  const outside = join(f.root, 'outside'); mkdirSync(outside); symlinkSync(outside, join(f.repo, '.tryce/notes'), 'junction');
  await assert.rejects(call(f, 'list'), { code: 'PATH_CONFLICT' }); assert.deepEqual(readdirSync(outside), []);
});

test('a competing writer reports a lock and leaves the winning record intact', async t => {
  const f = await setup(t); await call(f, 'enable');
  let entered; const ready = new Promise(resolve => { entered = resolve; });
  let release; const gate = new Promise(resolve => { release = resolve; });
  const first = add(f, 'winner', {}, { beforeWrite: async () => { entered(); await gate; } });
  await ready;
  try { await assert.rejects(add(f, 'competitor'), { code: 'PROJECT_BUSY' }); } finally { release(); }
  const winner = await first;
  assert.deepEqual((await call(f, 'list')).notes, winner.notes);
});

test('linked worktree records stay local and built CLI supports file input and text output', async t => {
  const f = await setup(t); f.write('a', 'a'); f.commit('initialized');
  const other = join(f.root, 'other'); f.git(['worktree', 'add', '-b', 'other', other]);
  const before = fingerprint(f.repo);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const cli = args => spawnSync(process.execPath, [entry, 'note', ...args], { cwd: other, env: f.env, encoding: 'utf8', timeout: 35000 });
  const enabled = cli(['enable']); assert.equal(enabled.status, 0, enabled.stderr);
  const input = join(f.root, 'input.txt'); writeFileSync(input, '기각한 접근과 이유');
  const added = cli(['add', '--type', 'rejected', '--file', input]); assert.equal(added.status, 0, added.stderr);
  const note = notesV1.parse(JSON.parse(added.stdout)).notes[0];
  const shown = cli(['show', note.id, '--format', 'text']); assert.equal(shown.status, 0, shown.stderr); assert.match(shown.stdout, /기각한 접근/);
  const invalid = cli(['add', '--type', 'approved', '--message', 'no']); assert.equal(invalid.status, 1);
  assert.deepEqual(fingerprint(f.repo), before);
});

test('process termination leaves the migration backup and lock for explicit recovery', async t => {
  const f = await setup(t); const original = readFileSync(configPath(f));
  const moduleUrl = new URL('../.test-build/commands/note.js', import.meta.url).href;
  const source = `import { noteCommand } from ${JSON.stringify(moduleUrl)}; await noteCommand(process.cwd(), 'enable', {}, undefined, process.env, { afterBackup: async () => process.exit(23) });`;
  const stopped = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  assert.equal(stopped.status, 23, stopped.stderr);
  assert.deepEqual(readFileSync(configPath(f)), original);
  const lock = join(f.repo, '.tryce/.notes.lock'); const bytes = readFileSync(lock);
  await assert.rejects(call(f, 'enable'), { code: 'PROJECT_BUSY' }); assert.deepEqual(readFileSync(lock), bytes);
  // The child has exited; remove exactly its lock in this temporary fixture.
  unlinkSync(lock);
  assert.equal((await call(f, 'enable')).outcome, 'enabled');
  assert.equal(readdirSync(join(f.repo, '.tryce')).filter(name => name.startsWith('config.init-1.')).length, 1);
});
