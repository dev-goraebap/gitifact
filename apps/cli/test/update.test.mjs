import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateV6 } from '@gitifact/contracts';
import { isNewerRelease, resolveUpdate, updateCheckDisabled, npmGlobalInstall } from '../.test-build/shared/update-check.js';
import { updateCommitMessage, updateCommand } from '../.test-build/commands/update.js';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { renderAgentBlock } from '../.test-build/commands/agent-block.js';
import { fixture, fingerprint } from './git-fixture.mjs';

// The block body ships beside the built entry point, so in-process tests read the source instead. No test touches the network.
// The block names no release; a marker line stands in for each release's block text, so a newer release has other text.
const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
const blockFor = version => async () => source.replace('## Gitifact Guide\n', '## Gitifact Guide\n\n<!-- release ' + version + ' -->\n');
const render = version => renderAgentBlock({ readBlock: blockFor(version) });
const latest = version => async () => version;
const configOf = f => JSON.parse(readFileSync(join(f.repo, '.gitifact/config.json'), 'utf8'));

test('init and update text guide both languages to the global install', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const preload = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = async () => new Response(JSON.stringify({"dist-tags":{"latest":"9.9.9"}}));');
  for (const language of ['ko', 'en']) for (const command of ['init', 'update']) {
    const result = spawnSync(process.execPath, ['--import', preload, entry, '--lang', language, command, '--format', 'text'], {
      cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' }, encoding: 'utf8', timeout: 35000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /npm install -g gitifact@9\.9\.9/);
    assert.match(result.stdout, /gitifact update/);
    assert.doesNotMatch(result.stdout, /npx|\{command\}/);
    // init and update report the release they checked themselves; no second notice repeats it.
    assert.doesNotMatch(result.stderr, /9\.9\.9/);
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

test('update reports versions everywhere, rewrites only existing blocks and sets the project to its release', async t => {
  const f = fixture(t);
  // The fetch is supplied, so the check can run here without the network.
  const on = { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' };
  const run = (cwd, version, env = on, fetchLatest = latest('9.9.9')) => updateCommand(cwd, version, env, { fetchLatest, readBlock: blockFor(version) });
  // Outside a repository, and in one that was never initialized, only the version check runs.
  const outside = await run(f.root, '0.4.0');
  assert.deepEqual([outside.update, outside.install, outside.agentDocs, outside.project],
    [{ status: 'available', latestVersion: '9.9.9' }, { npmGlobal: 'npm install -g gitifact@9.9.9' }, { state: 'not-initialized', paths: [], missing: [] }, { state: 'not-initialized', cli: null }]);
  f.write('AGENTS.md', '# Mine\n');
  const before = fingerprint(f.repo);
  assert.deepEqual((await run(f.repo, '0.4.0')).agentDocs, { state: 'not-initialized', paths: [], missing: [] });
  assert.deepEqual(fingerprint(f.repo), before);
  // Initialized without any block: nothing is created, but the config names the release and the block language.
  await initializeSpecProject(f.repo, false, f.env);
  const bare = await run(f.repo, '0.4.0');
  assert.deepEqual([bare.agentDocs, bare.project], [{ state: 'no-block', paths: [], missing: [] }, { state: 'written', cli: '0.4.0' }]);
  assert.deepEqual([configOf(f).cli, configOf(f).language], ['0.4.0', 'ko']);
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
  // A block from an older CLI is rewritten in place; user text and files without a block stay as they are.
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.3.0', readBlock: blockFor('0.3.0') });
  f.write('CLAUDE.md', '# Claude only\n');
  const old = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  // init with an older CLI did not lower the project, and left the blocks as they were: there were none, so it wrote none.
  assert.equal(configOf(f).cli, '0.4.0');
  assert.equal(old, '# Mine\n');
  writeFileSync(join(f.repo, 'AGENTS.md'), '# Mine\n\n' + await render('0.3.0') + '\n');
  const refreshed = await run(f.repo, '0.5.0', on, latest('0.5.0'));
  assert.deepEqual([refreshed.update.status, refreshed.install, refreshed.agentDocs, refreshed.project],
    ['up-to-date', null, { state: 'refreshed', paths: ['AGENTS.md'], missing: [] }, { state: 'written', cli: '0.5.0' }]);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), '# Mine\n\n' + await render('0.5.0') + '\n');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '# Claude only\n');
  const settled = fingerprint(f.repo);
  const again = await run(f.repo, '0.5.0', on, latest('0.5.0'));
  assert.deepEqual([again.agentDocs, again.project], [{ state: 'current', paths: ['AGENTS.md'], missing: [] }, { state: 'current', cli: '0.5.0' }]);
  assert.deepEqual(fingerprint(f.repo), settled);
  // An older CLI leaves the newer project's blocks and release alone.
  const older = await run(f.repo, '0.4.9', on, latest('0.5.0'));
  assert.deepEqual([older.agentDocs.state, older.project], ['kept', { state: 'current', cli: '0.5.0' }]);
  assert.deepEqual(fingerprint(f.repo), settled);
  // Disabled by environment: the registry is never asked, the block is still maintained.
  let asked = 0;
  const disabled = await run(f.repo, '0.5.0', { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, async () => { asked++; return '9.9.9'; });
  assert.deepEqual([disabled.update, disabled.install, asked], [{ status: 'disabled', latestVersion: null }, null, 0]);
  assert.equal(updateV6.safeParse(disabled).success, true);
  // Offline still succeeds and says so.
  assert.equal((await run(f.repo, '0.5.0', on, async () => { throw new Error('offline'); })).update.status, 'unavailable');
  // Fields a later release added to the config are kept when this one writes it.
  writeFileSync(join(f.repo, '.gitifact/config.json'), JSON.stringify({ ...configOf(f), future: { keep: true } }, null, 2) + '\n');
  await run(f.repo, '0.6.0', on, latest('0.6.0'));
  assert.deepEqual([configOf(f).cli, configOf(f).future], ['0.6.0', { keep: true }]);
  // A broken marker pair is refused without touching anything.
  f.write('AGENTS.md', '<!-- GITIFACT:START -->\nbroken\n');
  const broken = fingerprint(f.repo);
  await assert.rejects(run(f.repo, '0.7.0'), { code: 'AGENT_DOCS_MALFORMED' });
  assert.deepEqual(fingerprint(f.repo), broken);
});

test('built update command prints the contract and a text form without contacting the registry when disabled', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  const cli = (...args) => spawnSync(process.execPath, [entry, ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 35000 });
  assert.equal(cli('init').status, 0);
  const json = cli('update'); assert.equal(json.status, 0, json.stderr); assert.equal(json.stderr, '');
  const dto = updateV6.parse(JSON.parse(json.stdout));
  assert.deepEqual([dto.version, dto.cliVersion, dto.update.status, dto.install, dto.agentDocs, dto.project, dto.commit.state, dto.migrationRequired],
    [6, version, 'disabled', null, { state: 'current', paths: ['AGENTS.md'], missing: [] }, { state: 'current', cli: version }, 'not-requested', false]);
  // AGENTS.md was never committed, so --commit refuses it instead of committing a new file.
  const refused = cli('update', '--commit'); assert.equal(refused.status, 0, refused.stderr);
  assert.deepEqual(updateV6.parse(JSON.parse(refused.stdout)).commit, { state: 'skipped', commit: null, paths: ['AGENTS.md'], message: null, reason: 'untracked', detail: null });
  assert.match(cli('update', '--commit', '--format', 'text').stdout, /Git이 추적하지 않는 지침 파일입니다: AGENTS\.md/);
  const text = cli('update', '--format', 'text'); assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, new RegExp('^현재 버전: ' + version.replaceAll('.', '\\.') + '\n'));
  assert.match(text.stdout, /AGENTS\.md/);
  assert.notEqual(cli('update', 'extra').status, 0);
  // Without the CLAUDE.md init added, update names it and points back to init instead of creating it.
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  rmSync(join(f.repo, 'CLAUDE.md'));
  assert.deepEqual(updateV6.parse(JSON.parse(cli('update').stdout)).agentDocs, { state: 'current', paths: ['AGENTS.md'], missing: ['CLAUDE.md'] });
  assert.match(cli('update', '--format', 'text').stdout, /CLAUDE\.md 파일이 없어 .*gitifact init을 다시 실행하면/);
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
  assert.equal(cli('init').status, 0);
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.deepEqual(updateV6.parse(JSON.parse(cli('update').stdout)).agentDocs.missing, []);
  // A project set to a newer release keeps its blocks, and the text says how to catch up.
  const configPath = join(f.repo, '.gitifact/config.json');
  const current = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(configPath, JSON.stringify({ ...current, cli: '99.0.0' }, null, 2) + '\n');
  const ahead = cli('update', '--format', 'text').stdout;
  assert.match(ahead, /새 버전 기준이라 지침 블록을 그대로 두었습니다: AGENTS\.md/);
  assert.match(ahead, /npm install -g gitifact@99\.0\.0/);
  // A 0.7 project still gets the new block, and the result says the documents have to be migrated first.
  writeFileSync(configPath, JSON.stringify({ ...current, schemaVersion: 2 }, null, 2) + '\n');
  assert.equal(updateV6.parse(JSON.parse(cli('update').stdout)).migrationRequired, true);
  const notice = cli('update', '--format', 'text').stdout;
  assert.match(notice, /^이 프로젝트의 문서는 아직 0\.7 저장 규약\(schemaVersion 2\)입니다\. .*specs·instructions·records·check·changes 명령이 .*guide show migrate/m);
  // The notice names the commands that exist, never the docs command that was removed.
  assert.doesNotMatch(notice, /\bdocs\b/);
});

test('update --commit commits only block-only and release-only changes with the fixed message and keeps other staging', async t => {
  const f = fixture(t);
  const identity = { GIT_AUTHOR_NAME: 'Update', GIT_AUTHOR_EMAIL: 'update@example.invalid', GIT_COMMITTER_NAME: 'Update', GIT_COMMITTER_EMAIL: 'update@example.invalid' };
  const env = { ...f.env, ...identity, GITIFACT_NO_UPDATE_CHECK: '1' };
  const run = (version, commit = true, extraEnv = env) => updateCommand(f.repo, version, extraEnv, { readBlock: blockFor(version), commit });
  const head = () => f.git(['rev-parse', 'HEAD']).stdout.trim();
  f.write('AGENTS.md', '# Mine\n'); f.write('work.txt', 'base\n');
  await initializeSpecProject(f.repo, false, f.env, undefined, { version: '0.3.0', readBlock: blockFor('0.3.0') });
  f.commit('adopt');
  // Without --commit nothing is committed, as before.
  assert.equal((await run('0.4.0', false)).commit.state, 'not-requested');
  assert.equal(f.git(['log', '--format=%s', '-1']).stdout.trim(), 'adopt');
  // An unrelated staged change and an unstaged edit survive the commit untouched.
  f.write('work.txt', 'staged\n'); f.git(['add', 'work.txt']); f.write('work.txt', 'unstaged\n');
  const before = head();
  const result = await run('0.4.0');
  assert.equal(updateV6.safeParse(result).success, true);
  // The earlier plain update already refreshed both; the commit carries the block and the release together.
  assert.deepEqual({ ...result.commit, commit: null }, { state: 'committed', commit: null, paths: ['.gitifact/config.json', 'AGENTS.md'], message: updateCommitMessage('0.4.0'), reason: null, detail: null });
  assert.equal(result.commit.commit, head());
  assert.equal(f.git(['rev-parse', 'HEAD^']).stdout.trim(), before);
  assert.equal(f.git(['log', '--format=%B', '-1']).stdout.trim(), 'chore(gitifact): update project to gitifact v0.4.0');
  assert.equal(f.git(['show', 'HEAD:AGENTS.md']).stdout, '# Mine\n\n' + await render('0.4.0') + '\n');
  assert.equal(JSON.parse(f.git(['show', 'HEAD:.gitifact/config.json']).stdout).cli, '0.4.0');
  assert.equal(f.git(['diff', '--cached', '--name-only']).stdout, 'work.txt\n');
  assert.equal(f.git(['show', ':work.txt']).stdout, 'staged\n');
  assert.equal(readFileSync(join(f.repo, 'work.txt'), 'utf8'), 'unstaged\n');
  // Nothing left to commit on a second run.
  assert.equal((await run('0.4.0')).commit.state, 'nothing');
  // Other edits to the config stop the commit, as edits outside the block do.
  const configPath = join(f.repo, '.gitifact/config.json');
  const committedConfig = readFileSync(configPath, 'utf8');
  writeFileSync(configPath, JSON.stringify({ ...JSON.parse(committedConfig), future: 1 }, null, 2) + '\n');
  const edited = await run('0.4.1');
  assert.deepEqual([edited.commit.state, edited.commit.reason, edited.commit.paths], ['skipped', 'other-changes', ['.gitifact/config.json']]);
  writeFileSync(configPath, committedConfig);
  // A refresh left uncommitted by a plain update is still committed later.
  await run('0.4.2', false);
  const later = await run('0.4.2');
  assert.deepEqual([later.agentDocs.state, later.project.state, later.commit.state, later.commit.paths], ['current', 'current', 'committed', ['.gitifact/config.json', 'AGENTS.md']]);
  // Edits outside the block stop the commit; the block is still refreshed and HEAD stays.
  f.write('AGENTS.md', readFileSync(join(f.repo, 'AGENTS.md'), 'utf8') + '\nMy own note.\n');
  const settled = head();
  const mixed = await run('0.5.0');
  assert.deepEqual([mixed.agentDocs.state, mixed.commit.state, mixed.commit.reason, mixed.commit.paths], ['refreshed', 'skipped', 'other-changes', ['AGENTS.md']]);
  assert.equal(head(), settled);
  assert.match(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), /release 0\.5\.0 [\s\S]*My own note\./);
  // A commit Git rejects (here: no identity) keeps HEAD and the refreshed file, and reports why.
  f.git(['checkout', '--', 'AGENTS.md', '.gitifact/config.json']);
  const rejected = await run('0.6.0', true, { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1', GIT_COMMITTER_EMAIL: '', GIT_AUTHOR_EMAIL: '', EMAIL: '' , GIT_CONFIG_PARAMETERS: "'user.useConfigOnly'='true'" });
  assert.deepEqual([rejected.commit.state, rejected.commit.reason, rejected.commit.paths], ['skipped', 'commit-failed', ['AGENTS.md', '.gitifact/config.json']]);
  assert.equal(head(), settled);
  assert.match(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), /release 0\.6\.0 /);
  assert.equal(f.git(['show', ':work.txt']).stdout, 'staged\n');
});
