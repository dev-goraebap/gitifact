import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { updateCheckV1 } from '@gitifact/contracts';
import { checkUpdateCommand } from '../.test-build/commands/update-check.js';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { fixture, fingerprint } from './git-fixture.mjs';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const preload = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = async () => new Response(JSON.stringify({"dist-tags":{"latest":"9.9.9"}}));');

test('check-only reports release states without requiring a project', async () => {
  for (const [latest, status] of [['0.8.0', 'available'], ['0.7.0', 'up-to-date'], ['0.6.0', 'up-to-date'], ['invalid', 'unavailable']]) {
    const dto = updateCheckV1.parse(await checkUpdateCommand('0.7.0', {}, { fetchLatest: async () => latest }));
    assert.equal(dto.update.status, status);
    assert.equal(dto.command, status === 'available' ? 'npx --yes gitifact@0.8.0 update' : null);
  }
  const offline = await checkUpdateCommand('0.7.0', {}, { fetchLatest: async () => { throw new Error('offline'); } });
  assert.deepEqual(offline.update, { status: 'unavailable', latestVersion: null });
  const timeout = await checkUpdateCommand('0.7.0', {}, { fetchLatest: () => new Promise(() => {}), timeoutMs: 20 });
  assert.deepEqual(timeout.update, offline.update);
  let asked = 0;
  const disabled = await checkUpdateCommand('0.7.0', { GITIFACT_NO_UPDATE_CHECK: '1' }, { fetchLatest: async () => { asked++; return '0.8.0'; } });
  assert.equal(disabled.update.status, 'disabled');
  assert.equal(asked, 0);
});

test('check-only preserves old blocks, staged edits, files and HEAD in both languages', async t => {
  const f = fixture(t);
  const readBlock = async () => readFileSync(new URL('../src/shared/i18n/ko/block.md', import.meta.url), 'utf8');
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.6.0', readBlock });
  f.commit();
  f.write('staged.txt', 'staged');
  f.git(['add', 'staged.txt']);
  f.write('staged.txt', 'working copy');
  const before = fingerprint(f.root);
  for (const cwd of [f.repo, f.root]) for (const language of ['ko', 'en']) for (const format of ['json', 'text']) {
    const result = spawnSync(process.execPath, ['--import', preload, entry, '--lang', language, 'update', '--check', '--format', format], {
      cwd, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    if (format === 'json') assert.equal(updateCheckV1.parse(JSON.parse(result.stdout)).update.status, 'available');
    else assert.match(result.stdout, /npx --yes gitifact@9\.9\.9 update/);
    assert.deepEqual(fingerprint(f.root), before);
  }
  // A malformed block must not turn a read-only registry check into a project error.
  f.write('AGENTS.md', '<!-- GITIFACT:START -->\nbroken');
  const broken = fingerprint(f.root);
  const checked = spawnSync(process.execPath, ['--import', preload, entry, 'update', '--check'], {
    cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(fingerprint(f.root), broken);
  for (const args of [['--check', '--commit'], ['--commit', '--check']]) {
    const rejected = spawnSync(process.execPath, [entry, 'update', ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 10000 });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /--check.*--commit|--commit.*--check/);
    assert.deepEqual(fingerprint(f.root), broken);
  }
});
