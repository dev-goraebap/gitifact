import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateV5 } from '@gitifact/contracts';
import { isNewerRelease, resolveUpdate, updateCheckDisabled, npmGlobalInstall } from '../.test-build/shared/update-check.js';
import { blockCommitMessage, updateCommand } from '../.test-build/commands/update.js';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { renderAgentBlock } from '../.test-build/commands/agent-block.js';
import { fixture, fingerprint } from './git-fixture.mjs';

// The block body ships beside the built entry point, so in-process tests read the source instead. No test touches the network.
const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
const readBlock = async () => source;
const latest = version => async () => version;

test('init and update text guide both languages to the pinned npx command', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const preload = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = async () => new Response(JSON.stringify({"dist-tags":{"latest":"9.9.9"}}));');
  for (const language of ['ko', 'en']) for (const command of ['init', 'update']) {
    const result = spawnSync(process.execPath, ['--import', preload, entry, '--lang', language, command, '--format', 'text'], {
      cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' }, encoding: 'utf8', timeout: 35000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /npx --yes gitifact@9\.9\.9 update/);
    assert.doesNotMatch(result.stdout, /npm install -g|\{command\}/);
  }
});

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
  assert.deepEqual([outside.update, outside.install, outside.agentDocs], [{ status: 'available', latestVersion: '9.9.9' }, { npx: 'npx --yes gitifact@9.9.9 update', npmGlobal: 'npm install -g gitifact@9.9.9' }, { state: 'not-initialized', paths: [], missing: [] }]);
  f.write('AGENTS.md', '# Mine\n');
  const before = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0')).agentDocs, { state: 'not-initialized', paths: [], missing: [] });
  assert.deepEqual(fingerprint(f.repo), before);
  // Initialized without any block: nothing is created.
  await initializeSpecProject(f.repo, false, f.env);
  const initialized = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0')).agentDocs, { state: 'no-block', paths: [], missing: [] });
  assert.deepEqual(fingerprint(f.repo), initialized);
  // A block from an older CLI is rewritten in place; user text and files without a block stay as they are.
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.3.0', readBlock });
  f.write('CLAUDE.md', '# Claude only\n');
  const old = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.match(old, /^# Mine\n\n<!-- GITIFACT:START -->\n## Gitifact Guide\n\ngitifact v0\.3\.0 /);
  const refreshed = await run(f.repo, '0.4.0', f.env, latest('0.4.0'));
  assert.deepEqual([refreshed.update.status, refreshed.install, refreshed.agentDocs], ['up-to-date', null, { state: 'refreshed', paths: ['AGENTS.md'], missing: [] }]);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), '# Mine\n\n' + await renderAgentBlock('0.4.0', { readBlock }) + '\n');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '# Claude only\n');
  const settled = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0', f.env, latest('0.4.0'))).agentDocs, { state: 'current', paths: ['AGENTS.md'], missing: [] });
  assert.deepEqual(fingerprint(f.repo), settled);
  // Disabled by environment: the registry is never asked, the block is still maintained.
  let asked = 0;
  const disabled = await run(f.repo, '0.4.0', { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, async () => { asked++; return '9.9.9'; });
  assert.deepEqual([disabled.update, disabled.install, asked], [{ status: 'disabled', latestVersion: null }, null, 0]);
  assert.equal(updateV5.safeParse(disabled).success, true);
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
  const dto = updateV5.parse(JSON.parse(json.stdout));
  assert.deepEqual([dto.version, dto.cliVersion, dto.update.status, dto.install, dto.agentDocs, dto.commit.state, dto.migrationRequired], [5, version, 'disabled', null, { state: 'current', paths: ['AGENTS.md'], missing: [] }, 'not-requested', false]);
  // AGENTS.md was never committed, so --commit refuses it instead of committing a new file.
  const refused = cli('update', '--commit'); assert.equal(refused.status, 0, refused.stderr);
  assert.deepEqual(updateV5.parse(JSON.parse(refused.stdout)).commit, { state: 'skipped', commit: null, paths: ['AGENTS.md'], message: null, reason: 'untracked', detail: null });
  assert.match(cli('update', '--commit', '--format', 'text').stdout, /Git이 추적하지 않는 지침 파일입니다: AGENTS\.md/);
  const text = cli('update', '--format', 'text'); assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, new RegExp('^현재 버전: ' + version.replaceAll('.', '\\.') + '\n'));
  assert.match(text.stdout, /AGENTS\.md/);
  assert.notEqual(cli('update', 'extra').status, 0);
  // Without the CLAUDE.md init added, update names it and points back to init instead of creating it.
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  rmSync(join(f.repo, 'CLAUDE.md'));
  assert.deepEqual(updateV5.parse(JSON.parse(cli('update').stdout)).agentDocs, { state: 'current', paths: ['AGENTS.md'], missing: ['CLAUDE.md'] });
  assert.match(cli('update', '--format', 'text').stdout, /CLAUDE\.md 파일이 없어 .*npx --yes gitifact@\S+ init을 다시 실행하면/);
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
  assert.equal(cli('init').status, 0);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.deepEqual(updateV5.parse(JSON.parse(cli('update').stdout)).agentDocs.missing, []);
  // A 0.7 project still gets the new block, and the result says the documents have to be migrated first.
  const configPath = join(f.repo, '.gitifact/config.json');
  writeFileSync(configPath, JSON.stringify({ ...JSON.parse(readFileSync(configPath, 'utf8')), schemaVersion: 2 }, null, 2) + '\n');
  assert.equal(updateV5.parse(JSON.parse(cli('update').stdout)).migrationRequired, true);
  assert.match(cli('update', '--format', 'text').stdout, /^이 프로젝트의 문서는 아직 0\.7 저장 규약\(schemaVersion 2\)입니다\. .*guide show migrate/m);
});

test('update --commit commits only block-only refreshes with the fixed message and keeps other staging', async t => {
  const f = fixture(t);
  const identity = { GIT_AUTHOR_NAME: 'Update', GIT_AUTHOR_EMAIL: 'update@example.invalid', GIT_COMMITTER_NAME: 'Update', GIT_COMMITTER_EMAIL: 'update@example.invalid' };
  const env = { ...f.env, ...identity, GITIFACT_NO_UPDATE_CHECK: '1' };
  const run = (version, commit = true, extraEnv = env) => updateCommand(f.repo, version, extraEnv, { readBlock, commit });
  const head = () => f.git(['rev-parse', 'HEAD']).stdout.trim();
  f.write('AGENTS.md', '# Mine\n'); f.write('work.txt', 'base\n');
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.3.0', readBlock });
  f.commit('adopt');
  // Without --commit nothing is committed, as before.
  assert.equal((await run('0.4.0', false)).commit.state, 'not-requested');
  assert.equal(f.git(['log', '--format=%s', '-1']).stdout.trim(), 'adopt');
  // An unrelated staged change and an unstaged edit survive the commit untouched.
  f.write('work.txt', 'staged\n'); f.git(['add', 'work.txt']); f.write('work.txt', 'unstaged\n');
  const before = head();
  const result = await run('0.4.0');
  assert.equal(updateV5.safeParse(result).success, true);
  assert.deepEqual({ ...result.commit, commit: null }, { state: 'committed', commit: null, paths: ['AGENTS.md'], message: blockCommitMessage('0.4.0'), reason: null, detail: null });
  assert.equal(result.commit.commit, head());
  assert.equal(f.git(['rev-parse', 'HEAD^']).stdout.trim(), before);
  assert.equal(f.git(['log', '--format=%B', '-1']).stdout.trim(), 'chore(gitifact): refresh GITIFACT block to v0.4.0');
  assert.equal(f.git(['show', 'HEAD:AGENTS.md']).stdout, '# Mine\n\n' + await renderAgentBlock('0.4.0', { readBlock }) + '\n');
  assert.equal(f.git(['diff', '--cached', '--name-only']).stdout, 'work.txt\n');
  assert.equal(f.git(['show', ':work.txt']).stdout, 'staged\n');
  assert.equal(readFileSync(join(f.repo, 'work.txt'), 'utf8'), 'unstaged\n');
  // Nothing left to commit on a second run.
  assert.equal((await run('0.4.0')).commit.state, 'nothing');
  // A refresh left uncommitted by a plain update is still committed later.
  await run('0.4.1', false);
  const later = await run('0.4.1');
  assert.deepEqual([later.agentDocs.state, later.commit.state, later.commit.paths], ['current', 'committed', ['AGENTS.md']]);
  // Edits outside the block stop the commit; the block is still refreshed and HEAD stays.
  f.write('AGENTS.md', readFileSync(join(f.repo, 'AGENTS.md'), 'utf8') + '\nMy own note.\n');
  const settled = head();
  const mixed = await run('0.5.0');
  assert.deepEqual([mixed.agentDocs.state, mixed.commit.state, mixed.commit.reason, mixed.commit.paths], ['refreshed', 'skipped', 'other-changes', ['AGENTS.md']]);
  assert.equal(head(), settled);
  assert.match(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), /gitifact v0\.5\.0 [\s\S]*My own note\./);
  // A commit Git rejects (here: no identity) keeps HEAD and the refreshed file, and reports why.
  f.git(['checkout', '--', 'AGENTS.md']);
  const rejected = await run('0.6.0', true, { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1', GIT_COMMITTER_EMAIL: '', GIT_AUTHOR_EMAIL: '', EMAIL: '' , GIT_CONFIG_PARAMETERS: "'user.useConfigOnly'='true'" });
  assert.deepEqual([rejected.commit.state, rejected.commit.reason, rejected.commit.paths], ['skipped', 'commit-failed', ['AGENTS.md']]);
  assert.equal(head(), settled);
  assert.match(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), /gitifact v0\.6\.0 /);
  assert.equal(f.git(['show', ':work.txt']).stdout, 'staged\n');
});
