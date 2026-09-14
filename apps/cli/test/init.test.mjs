import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeProject } from '../.test-build/commands/init.js';
import { projectInitV1 } from '@tryce/contracts';
import { fixture, fingerprint } from './git-fixture.mjs';

const path = f => join(f.repo, '.tryce', 'config.json');
const init = (f, options = { mode: 'prototype' }, cwd = f.repo, hook) => initializeProject(cwd, options, f.env, hook);
const preserved = (before, after) => { for (const [key, value] of Object.entries(before)) assert.equal(after[key], value, key); };

test('dry-run is read-only; unborn init is complete, repeatable and preserves bytes', async t => {
  const f = fixture(t); f.write('work.txt', 'untouched');
  const before = fingerprint(f.repo);
  assert.equal((await init(f, { mode: 'prototype', dryRun: true })).outcome, 'planned');
  assert.deepEqual(fingerprint(f.repo), before);
  const created = projectInitV1.parse(await init(f));
  assert.equal(created.outcome, 'created'); assert.deepEqual(created.baseline, { kind: 'empty' });
  preserved(before, fingerprint(f.repo));
  assert.deepEqual(readdirSync(join(f.repo, '.tryce')), ['config.json']);
  const bytes = readFileSync(path(f));
  assert.equal((await init(f, {})).outcome, 'already-initialized');
  assert.deepEqual(readFileSync(path(f)), bytes);
  await assert.rejects(init(f, { mode: 'normal' }), { code: 'MODE_CONFLICT' });
  assert.deepEqual(readFileSync(path(f)), bytes);
});

test('SHA-1 and SHA-256 baselines survive new commits and detached subdirectory execution', async t => {
  for (const format of ['sha1', 'sha256']) {
    const f = fixture(t, format); f.write('a', 'first'); f.commit();
    const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
    f.git(['checkout', '--detach']); mkdirSync(join(f.repo, 'sub'));
    f.write('a', 'staged'); f.git(['add', 'a']); f.write('a', 'unstaged');
    const before = fingerprint(f.repo);
    const result = await init(f, { mode: 'normal' }, join(f.repo, 'sub'));
    assert.equal(result.baseline.commit, head); assert.equal(result.baseline.objectFormat, format);
    preserved(before, fingerprint(f.repo));
    f.commit('adoption');
    const bytes = readFileSync(path(f));
    assert.equal((await init(f, {})).baseline.commit, head);
    assert.deepEqual(readFileSync(path(f)), bytes);
  }
});

test('default mode dry run, ignore rules, tracked deletion and malformed files never overwrite data', async t => {
  const f = fixture(t);
  assert.equal((await init(f, { dryRun: true })).mode, 'auto');
  assert.equal(existsSync(join(f.repo, '.tryce')), false);
  f.write('.gitignore', '.tryce/\n');
  await assert.rejects(init(f), { code: 'CONFIG_IGNORED' });
  assert.equal(existsSync(join(f.repo, '.tryce')), false);
  f.write('.gitignore', '.tryce/*\n!.tryce/config.json\n');
  await init(f); f.commit(); unlinkSync(path(f));
  const before = fingerprint(f.repo);
  await assert.rejects(init(f), { code: 'CONFIG_DELETED' });
  assert.deepEqual(fingerprint(f.repo), before);
  for (const [text, code] of [['{', 'INVALID_CONFIG'], [JSON.stringify({ kind: 'tryce-project', format: 'init-99' }), 'UNSUPPORTED_FORMAT']]) {
    writeFileSync(path(f), text);
    await assert.rejects(init(f), { code }); assert.equal(readFileSync(path(f), 'utf8'), text);
  }
});

test('operation markers, unrelated baselines and path links are refused', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit();
  f.write('.git/MERGE_HEAD', 'a'.repeat(40));
  await assert.rejects(init(f), { code: 'GIT_OPERATION_IN_PROGRESS' });
  unlinkSync(join(f.repo, '.git/MERGE_HEAD'));
  const target = join(f.root, 'target'); mkdirSync(target);
  symlinkSync(target, join(f.repo, '.tryce'), 'junction');
  await assert.rejects(init(f), { code: 'PATH_CONFLICT' });
  assert.deepEqual(readdirSync(target), []);
  // Junction cleanup stays within the temporary fixture and removes only the link.
  const { rmdirSync } = await import('node:fs'); rmdirSync(join(f.repo, '.tryce'));
  await init(f);
  const config = JSON.parse(readFileSync(path(f), 'utf8'));
  config.baseline.commit = 'f'.repeat(40); writeFileSync(path(f), JSON.stringify(config));
  await assert.rejects(init(f), { code: 'BASELINE_UNAVAILABLE' });
  assert.equal(JSON.parse(readFileSync(path(f), 'utf8')).baseline.commit, 'f'.repeat(40));
});

test('parallel init publishes one config and conflicting mode never overwrites the winner', async t => {
  const f = fixture(t);
  const results = await Promise.all([init(f), init(f)]);
  assert.deepEqual(results.map(r => r.outcome).sort(), ['already-initialized', 'created']);
  assert.deepEqual(readdirSync(join(f.repo, '.tryce')), ['config.json']);
  assert.equal(JSON.parse(readFileSync(path(f), 'utf8')).mode, 'prototype');
});

test('input changes and injected failure leave user files intact and permit retry', async t => {
  const f = fixture(t); f.write('a', 'original'); f.commit();
  await assert.rejects(init(f, { mode: 'prototype' }, f.repo, async () => { f.write('a', 'new'); f.git(['add', 'a']); }), { code: 'INPUT_CHANGED' });
  assert.equal(existsSync(path(f)), false); assert.equal(readFileSync(join(f.repo, 'a'), 'utf8'), 'new');
  assert.deepEqual(readdirSync(join(f.repo, '.tryce')), []);
  await assert.rejects(init(f, { mode: 'prototype' }, f.repo, async () => { throw new Error('disk failure'); }), /disk failure/);
  assert.deepEqual(readdirSync(join(f.repo, '.tryce')), []);
  assert.equal((await init(f)).outcome, 'created');
});

test('a concurrently created user config is preserved and validated', async t => {
  const f = fixture(t);
  const text = '{"kind":"tryce-project","format":"init-1","mode":"normal","baseline":{"kind":"empty"}}';
  await assert.rejects(init(f, { mode: 'prototype' }, f.repo, async () => { writeFileSync(path(f), text); }), { code: 'MODE_CONFLICT' });
  assert.equal(readFileSync(path(f), 'utf8'), text);
  assert.deepEqual(readdirSync(join(f.repo, '.tryce')), ['config.json']);
});

test('linked worktree initialization preserves the other checkout and shared Git data', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit();
  const other = join(f.root, 'other'); f.git(['worktree', 'add', '-b', 'other', other]);
  const before = fingerprint(f.repo);
  assert.equal((await init(f, { mode: 'prototype' }, other)).outcome, 'created');
  assert.deepEqual(fingerprint(f.repo), before);
  assert.equal(existsSync(join(f.repo, '.tryce')), false);
});

test('built command has versioned output and rejects options before writing', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const cli = args => spawnSync(process.execPath, [entry, 'init', ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  const bad = cli(['--mode', 'wrong']); assert.equal(bad.status, 1); assert.equal(existsSync(join(f.repo, '.tryce')), false);
  const missing = cli(['--dry-run']); assert.equal(missing.status, 0); assert.equal(JSON.parse(missing.stdout).schemaVersion, 1); assert.equal(JSON.parse(missing.stdout).mode, undefined);
  const good = cli(['--mode', 'prototype']); assert.equal(good.status, 0, good.stderr);
  assert.equal(projectInitV1.parse(JSON.parse(good.stdout)).outcome, 'created');
});

test('process termination before and after publication recovers without deleting unknown leftovers', async t => {
  const f = fixture(t);
  const moduleUrl = new URL('../.test-build/commands/init.js', import.meta.url).href;
  const run = source => spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  const prefix = `import { initializeProject } from ${JSON.stringify(moduleUrl)};`;
  const before = run(prefix + `await initializeProject(process.cwd(), { mode: 'prototype' }, process.env, async () => process.exit(23));`);
  assert.equal(before.status, 23, before.stderr);
  assert.equal(existsSync(path(f)), false);
  const leftovers = readdirSync(join(f.repo, '.tryce'));
  assert.equal(leftovers.length, 1);
  const bytes = readFileSync(join(f.repo, '.tryce', leftovers[0]));
  const after = run(prefix + `await initializeProject(process.cwd(), { mode: 'prototype' }); process.exit(24);`);
  assert.equal(after.status, 24, after.stderr);
  assert.equal((await init(f, {})).outcome, 'already-initialized');
  assert.deepEqual(readFileSync(join(f.repo, '.tryce', leftovers[0])), bytes);
});

test('clone and submodule use their own tracked config and preserve source checkout', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit(); await init(f); f.commit('init');
  const before = fingerprint(f.repo);
  const clone = join(f.root, 'clone'); f.git(['clone', '--no-hardlinks', f.repo, clone], f.root);
  assert.equal((await init(f, {}, clone)).outcome, 'already-initialized');
  const host = join(f.root, 'host'); mkdirSync(host); f.git(['init', '--template=', '-b', 'main'], host);
  f.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', f.repo, 'module'], host);
  assert.equal((await init(f, {}, join(host, 'module'))).outcome, 'already-initialized');
  assert.equal(existsSync(join(host, '.tryce')), false);
  assert.deepEqual(fingerprint(f.repo), before);
});

test('partial staging of existing config is reported without rewriting either version', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit(); await init(f); f.commit('init');
  const config = JSON.parse(readFileSync(path(f), 'utf8'));
  writeFileSync(path(f), JSON.stringify(config)); f.git(['add', '.tryce/config.json']);
  writeFileSync(path(f), JSON.stringify(config, null, 4) + '\n');
  const before = fingerprint(f.repo);
  assert.equal((await init(f, {})).configChanged, true);
  assert.deepEqual(fingerprint(f.repo), before);
});
