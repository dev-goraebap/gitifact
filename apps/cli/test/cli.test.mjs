import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const entrypoint = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('CLI works outside the workspace and leaves the working directory untouched', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'gitifact-cli-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const run = (...args) => {
    const result = spawnSync(process.execPath, [entrypoint, ...args], {
      cwd, env: { ...process.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 10_000,
    });
    assert.ifError(result.error);
    return result;
  };

  for (const args of [[], ['--help']]) {
    const result = run(...args);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Usage: gitifact/);
    assert.match(result.stdout, /아직 제공하지 않습니다/);
  }
  const result = run('--version');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), version);
  assert.equal(result.stderr, '');

  for (const args of [['not-a-command'], ['--unknown']]) {
    const failure = run(...args);
    assert.notEqual(failure.status, 0);
    assert.equal(failure.stdout, '');
    assert.match(failure.stderr, /error:/);
  }
  const init = run('init');
  assert.equal(init.status, 1);
  assert.equal(JSON.parse(init.stderr).error.code, 'NOT_A_REPOSITORY');
  assert.deepEqual(await readdir(cwd), []);
});
