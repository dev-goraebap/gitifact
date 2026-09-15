import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { skillsCommand } from '../.test-build/commands/skills.js';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
const source = '.agents/skills/gitifact-workflow/SKILL.md';
const target = '.claude/skills/gitifact-workflow/SKILL.md';
const manifest = '.agents/gitifact-skills.local.json';
const template = '---\nname: gitifact-workflow\ndescription: fixture\n---\nOriginal\n';
async function setup(t) {
  const f = fixture(t);
  await initializeSpecProject(f.repo, false, f.env);
  const run = (action, options = {}, controls = {}) => skillsCommand(f.repo, action, options, f.env, { template, ...controls });
  return { ...f, run, read: path => readFileSync(join(f.repo, path), 'utf8') };
}
test('install dry-run preserves all files; repeat, sync and remove preserve source and Git', async t => {
  const f = await setup(t); const before = fingerprint(f.repo);
  assert.equal((await f.run('install', { agent: 'claude', dryRun: true })).outcome, 'planned');
  assert.deepEqual(fingerprint(f.repo), before);
  await f.run('install', { agent: 'claude' });
  assert.equal(f.read(target), template);
  const config = f.read('.gitifact/config.json'); const git = fingerprint(join(f.repo, '.git'));
  await f.run('install', { agent: 'claude' });
  f.write(source, template + 'Custom project guidance\n');
  await f.run('sync');
  assert.equal(f.read(target), f.read(source));
  await f.run('remove');
  assert.equal(existsSync(join(f.repo, target)), false);
  assert.equal(f.read(source), template + 'Custom project guidance\n');
  assert.equal(f.read('.gitifact/config.json'), config);
  assert.deepEqual(fingerprint(join(f.repo, '.git')), git);
});
test('same-content unmanaged copy and later user edits are refused and preserved', async t => {
  const f = await setup(t);
  mkdirSync(join(f.repo, '.claude/skills/gitifact-workflow'), { recursive: true });
  f.write(target, template);
  await assert.rejects(f.run('install', { agent: 'claude' }), { code: 'UNMANAGED_SKILL' });
  assert.equal(f.read(target), template);
});
test('managed copy edits block sync and removal without modifying the source or journal', async t => {
  const f = await setup(t); await f.run('install', { agent: 'claude' });
  f.write(target, 'user changes'); const before = fingerprint(f.repo);
  await assert.rejects(f.run('sync'), { code: 'SKILL_MODIFIED' });
  await assert.rejects(f.run('remove'), { code: 'SKILL_MODIFIED' });
  assert.deepEqual(fingerprint(f.repo), before);
});
test('an existing source is preserved on install and a clone can create local copies', async t => {
  const f = await setup(t);
  mkdirSync(join(f.repo, '.agents/skills/gitifact-workflow'), { recursive: true });
  f.write(source, template + 'Project customization\n');
  await f.run('install', { agent: 'codex' });
  assert.equal(f.read(source), template + 'Project customization\n');
  f.commit();
  const clone = join(f.root, 'clone'); f.git(['clone', '--no-local', f.repo, clone]);
  assert.equal(existsSync(join(clone, manifest)), false);
  await skillsCommand(clone, 'sync', { agent: 'claude' }, f.env);
  assert.equal(readFileSync(join(clone, target), 'utf8'), f.read(source));
});
test('journal survives interrupted install and resumes without replacing unrelated files', async t => {
  const f = await setup(t);
  await assert.rejects(f.run('install', { agent: 'claude' }, { afterJournal: async () => { throw new Error('interrupted'); } }), /interrupted/);
  assert.equal(existsSync(join(f.repo, manifest)), true);
  await f.run('install', { agent: 'claude' });
  assert.equal(f.read(target), template);
  assert.equal(JSON.parse(f.read(manifest)).accepted.length, 1);
});
test('source ignore and junction conflicts do not overwrite user content', async t => {
  const f = await setup(t); f.write('.gitignore', '.agents/\n');
  await assert.rejects(f.run('install', { agent: 'claude', dryRun: true }), { code: 'CONFIG_IGNORED' });
  f.write('.gitignore', '');
  const outside = join(f.root, 'outside'); mkdirSync(outside);
  symlinkSync(outside, join(f.repo, '.claude'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.run('install', { agent: 'claude' }), { code: 'PATH_CONFLICT' });
  assert.equal(existsSync(join(outside, 'skills')), false);
});
test('partial staging is preserved and tracked local copies are rejected', async t => {
  const f = await setup(t); f.write('work.txt', 'staged'); f.git(['add', 'work.txt']); f.write('work.txt', 'working');
  const git = fingerprint(join(f.repo, '.git'));
  await f.run('install', { agent: 'claude' });
  assert.deepEqual(fingerprint(join(f.repo, '.git')), git);
  f.git(['add', '-f', target]);
  await assert.rejects(f.run('sync'), { code: 'LOCAL_SKILL_TRACKED' });
});
test('CLI output is versioned and unsupported agents do not touch the repository', async t => {
  const f = await setup(t);
  const executable = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const run = args => spawnSync(process.execPath, [executable, 'skills', ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  const before = fingerprint(f.repo);
  const bad = run(['install', '--agent', 'unknown']); assert.equal(bad.status, 1);
  assert.deepEqual(fingerprint(f.repo), before);
  const good = run(['install', '--agent', 'claude']); assert.equal(good.status, 0, good.stderr);
  assert.equal(good.stderr, ''); assert.equal(JSON.parse(good.stdout).contract, 'skills');
});
test('product lock and unsupported local manifest are preserved without writes', async t => {
  const f = await setup(t); await f.run('install', { agent: 'claude' });
  const lock = '.agents/gitifact-skills.local.lock'; f.write(lock, 'another writer');
  await assert.rejects(f.run('sync'), { code: 'SKILLS_BUSY' });
  assert.equal(f.read(lock), 'another writer');
  // Dry-run reads an unsupported version without taking or removing the existing lock.
  f.write(manifest, JSON.stringify({ ...JSON.parse(f.read(manifest)), version: 99 }));
  const before = fingerprint(f.repo);
  await assert.rejects(f.run('sync', { dryRun: true }), { code: 'UNSUPPORTED_SKILL_MANIFEST' });
  assert.deepEqual(fingerprint(f.repo), before);
});
test('product linked worktree installation leaves shared Git and original checkout unchanged', async t => {
  const f = await setup(t); f.commit();
  const linked = join(f.root, 'linked'); f.git(['worktree', 'add', '-b', 'skills-test', linked]);
  const before = fingerprint(f.repo);
  await skillsCommand(linked, 'install', { agent: 'claude' }, f.env, { template });
  assert.equal(readFileSync(join(linked, target), 'utf8'), template);
  assert.deepEqual(fingerprint(f.repo), before);
});
test('copy replacement after journaling is preserved and retry reports the edit', async t => {
  const f = await setup(t); await f.run('install', { agent: 'claude' });
  f.write(source, template + 'new source\n');
  await assert.rejects(f.run('sync', {}, { afterJournal: async () => f.write(target, 'concurrent user edit') }), { code: 'INPUT_CHANGED' });
  assert.equal(f.read(target), 'concurrent user edit');
  await assert.rejects(f.run('sync'), { code: 'SKILL_MODIFIED' });
});
