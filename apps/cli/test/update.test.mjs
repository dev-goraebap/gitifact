import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateV1 } from '@gitifact/contracts';
import { isNewerRelease, resolveUpdate, updateCheckDisabled, npmGlobalInstall } from '../.test-build/shared/update-check.js';
import { updateCommand } from '../.test-build/commands/update.js';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { renderAgentBlock } from '../.test-build/commands/agent-block.js';
import { fixture, fingerprint } from './git-fixture.mjs';

// The block body ships beside the built entry point, so in-process tests read the source instead. No test touches the network.
const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
const readBlock = async () => source;
const latest = version => async () => version;

test('only a plain release newer than the running CLI counts as an update', () => {
  for (const [next, now] of [['0.4.1', '0.4.0'], ['0.5.0', '0.4.9'], ['1.0.0', '0.99.99'], ['0.10.0', '0.9.0'], ['0.4.0', '0.4.0-dev.1']]) assert.equal(isNewerRelease(next, now), true, next + ' > ' + now);
  for (const [next, now] of [['0.4.0', '0.4.0'], ['0.3.9', '0.4.0'], ['0.4.0', '0.4.1-dev.1'], ['0.4.1-beta.1', '0.4.0'], ['latest', '0.4.0'], ['0.4.1', 'unknown'], ['', '0.4.0']]) assert.equal(isNewerRelease(next, now), false, next + ' > ' + now);
  assert.equal(npmGlobalInstall('0.4.1'), 'npm install -g gitifact@0.4.1');
  assert.equal(updateCheckDisabled({}), false);
  assert.equal(updateCheckDisabled({ GITIFACT_NO_UPDATE_CHECK: '1' }), true);
  assert.equal(updateCheckDisabled({ GITIFACT_NO_UPDATE_CHECK: '0' }), false);
  assert.equal(updateCheckDisabled({ GITIFACT_NO_UPDATE_CHECK: '' }), false);
  assert.equal(updateCheckDisabled({}, true), true);
});

test('a failed, slow or malformed registry answer is unavailable, never up to date', async () => {
  assert.deepEqual(await resolveUpdate('0.4.0', latest('0.4.1')), { status: 'available', latestVersion: '0.4.1' });
  assert.deepEqual(await resolveUpdate('0.4.0', latest('0.4.0')), { status: 'up-to-date', latestVersion: '0.4.0' });
  assert.deepEqual(await resolveUpdate('0.4.0', latest('0.3.0')), { status: 'up-to-date', latestVersion: '0.3.0' });
  const unavailable = { status: 'unavailable', latestVersion: null };
  assert.deepEqual(await resolveUpdate('0.4.0', async () => { throw new Error('offline'); }), unavailable);
  for (const value of ['1.0.0-rc.1', 'latest', '', 5, null]) assert.deepEqual(await resolveUpdate('0.4.0', latest(value)), unavailable);
  const started = Date.now();
  assert.deepEqual(await resolveUpdate('0.4.0', () => new Promise(() => {}), undefined, 50), unavailable);
  assert.ok(Date.now() - started < 2000);
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await resolveUpdate('0.4.0', signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))), controller.signal), unavailable);
  let received;
  await resolveUpdate('0.4.0', async signal => { received = signal; return '0.4.0'; });
  assert.ok(received instanceof AbortSignal);
});

test('update reports versions everywhere and rewrites only existing blocks of an initialized project', async t => {
  const f = fixture(t);
  const run = (cwd, version, env = f.env, fetchLatest = latest('9.9.9')) => updateCommand(cwd, version, env, { fetchLatest, readBlock });
  // Outside a repository, and in one that was never initialized, only the version check runs.
  const outside = await run(f.root, '0.4.0');
  assert.deepEqual([outside.update, outside.install, outside.agentDocs], [{ status: 'available', latestVersion: '9.9.9' }, { npmGlobal: 'npm install -g gitifact@9.9.9' }, { state: 'not-initialized', paths: [] }]);
  f.write('AGENTS.md', '# Mine\n');
  const before = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0')).agentDocs, { state: 'not-initialized', paths: [] });
  assert.deepEqual(fingerprint(f.repo), before);
  // Initialized without any block: nothing is created.
  await initializeSpecProject(f.repo, false, f.env);
  const initialized = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0')).agentDocs, { state: 'no-block', paths: [] });
  assert.deepEqual(fingerprint(f.repo), initialized);
  // A block from an older CLI is rewritten in place; user text and files without a block stay as they are.
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.3.0', readBlock });
  f.write('CLAUDE.md', '# Claude only\n');
  const old = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.match(old, /^# Mine\n\n<!-- GITIFACT:START -->\ngitifact v0\.3\.0 /);
  const refreshed = await run(f.repo, '0.4.0', f.env, latest('0.4.0'));
  assert.deepEqual([refreshed.update.status, refreshed.install, refreshed.agentDocs], ['up-to-date', null, { state: 'refreshed', paths: ['AGENTS.md'] }]);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), '# Mine\n\n' + await renderAgentBlock('0.4.0', { readBlock }) + '\n');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '# Claude only\n');
  const settled = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0', f.env, latest('0.4.0'))).agentDocs, { state: 'current', paths: ['AGENTS.md'] });
  assert.deepEqual(fingerprint(f.repo), settled);
  // Disabled by environment: the registry is never asked, the block is still maintained.
  let asked = 0;
  const disabled = await run(f.repo, '0.4.0', { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, async () => { asked++; return '9.9.9'; });
  assert.deepEqual([disabled.update, disabled.install, asked], [{ status: 'disabled', latestVersion: null }, null, 0]);
  assert.equal(updateV1.safeParse(disabled).success, true);
  // Offline still succeeds and says so.
  assert.equal((await run(f.repo, '0.4.0', f.env, async () => { throw new Error('offline'); })).update.status, 'unavailable');
  // A broken marker pair is refused without touching anything.
  f.write('AGENTS.md', '<!-- GITIFACT:START -->\nbroken\n');
  const broken = fingerprint(f.repo);
  await assert.rejects(run(f.repo, '0.4.0'), { code: 'AGENT_DOCS_MALFORMED' });
  assert.deepEqual(fingerprint(f.repo), broken);
});

test('built update command prints the contract and a text form without contacting the registry when disabled', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  const cli = (...args) => spawnSync(process.execPath, [entry, ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 35000 });
  assert.equal(cli('init').status, 0);
  const json = cli('update'); assert.equal(json.status, 0, json.stderr); assert.equal(json.stderr, '');
  const dto = updateV1.parse(JSON.parse(json.stdout));
  assert.deepEqual([dto.cliVersion, dto.update.status, dto.install, dto.agentDocs], [version, 'disabled', null, { state: 'current', paths: ['AGENTS.md'] }]);
  const text = cli('update', '--format', 'text'); assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, new RegExp('^현재 버전: ' + version.replaceAll('.', '\\.') + '\n'));
  assert.match(text.stdout, /AGENTS\.md/);
  assert.notEqual(cli('update', 'extra').status, 0);
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
});
