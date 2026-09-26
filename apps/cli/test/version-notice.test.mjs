import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { updateLaterV1 } from '@gitifact/contracts';
import { CHECKING_WINDOW_MS, LATER_MS, REFRESH_AFTER_MS, chooseNotice, needsRefresh, noticeScope, noticeText, noticeVersion, postponeRelease, refreshUpdateCache } from '../.test-build/commands/version-notice.js';
import { readUpdateCache, recordUpdateCheck, userCacheDirectory } from '../.test-build/adapters/filesystem/user-cache.js';
import { fixture } from './git-fixture.mjs';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
const now = Date.parse('2026-09-26T12:00:00.000Z');
const iso = time => new Date(time).toISOString();
const cacheFile = f => join(f.env.GITIFACT_CACHE_DIR, 'update.json');
const writeCache = (f, value) => { mkdirSync(f.env.GITIFACT_CACHE_DIR, { recursive: true }); writeFileSync(cacheFile(f), JSON.stringify(value)); };
const setProject = (f, cli) => {
  mkdirSync(join(f.repo, '.gitifact'), { recursive: true });
  writeFileSync(join(f.repo, '.gitifact/config.json'), JSON.stringify({ schemaVersion: 3, baseline: { kind: 'empty' }, ...(cli ? { cli } : {}) }));
};

test('one notice at most: a project ahead of the CLI, then a newer release, then a project behind it', () => {
  const fresh = { checkedAt: iso(now), latest: '0.8.4' };
  assert.deepEqual(chooseNotice('0.8.3', '0.8.5', fresh, now), { kind: 'project-newer', project: '0.8.5' });
  assert.deepEqual(chooseNotice('0.8.3', '0.8.2', fresh, now), { kind: 'release', latest: '0.8.4' });
  assert.deepEqual(chooseNotice('0.8.3', '0.8.2', {}, now), { kind: 'project-older', project: '0.8.2' });
  assert.equal(chooseNotice('0.8.3', '0.8.3', { latest: '0.8.3' }, now), null);
  assert.equal(chooseNotice('0.8.3', undefined, {}, now), null);
  // `update --later` quiets that release for a day; a newer one is announced at once, and the quiet ends on time.
  const later = { ...fresh, later: { version: '0.8.4', until: iso(now + LATER_MS) } };
  assert.equal(chooseNotice('0.8.3', '0.8.3', later, now), null);
  assert.deepEqual(chooseNotice('0.8.3', '0.8.3', { ...later, latest: '0.8.5' }, now), { kind: 'release', latest: '0.8.5' });
  assert.deepEqual(chooseNotice('0.8.3', '0.8.3', later, now + LATER_MS), { kind: 'release', latest: '0.8.4' });
  // A quieted release does not hide a project that is ahead.
  assert.deepEqual(chooseNotice('0.8.3', '0.8.4', later, now), { kind: 'project-newer', project: '0.8.4' });
  // init and update report the release themselves, and both are the answer to a project behind the CLI.
  assert.deepEqual(noticeScope('update'), { release: false, projectOlder: false });
  assert.deepEqual(noticeScope('init'), { release: false, projectOlder: false });
  assert.deepEqual(noticeScope('specs'), { release: true, projectOlder: true });
  assert.equal(chooseNotice('0.8.3', '0.8.2', fresh, now, noticeScope('update')), null);
  assert.deepEqual(chooseNotice('0.8.3', '0.8.5', fresh, now, noticeScope('update')), { kind: 'project-newer', project: '0.8.5' });
  // Each notice names the global install; nothing tells people to use npx.
  assert.match(noticeText({ kind: 'release', latest: '0.8.4' }, '0.8.3'), /^새 버전 0\.8\.4가 있습니다\(지금 0\.8\.3\)\. 업데이트: npm install -g gitifact@0\.8\.4 후 gitifact update · 나중에: gitifact update --later$/);
  assert.match(noticeText({ kind: 'project-newer', project: '0.8.4' }, '0.8.3'), /gitifact 0\.8\.4 기준입니다\(실행 중 0\.8\.3\)\. npm install -g gitifact@0\.8\.4로/);
  assert.match(noticeText({ kind: 'project-older', project: '0.8.2' }, '0.8.3'), /gitifact update로 프로젝트 기준을/);
});

test('the registry is asked again only after an hour, and never twice at once', () => {
  assert.equal(needsRefresh({}, now), true);
  assert.equal(needsRefresh({ checkedAt: iso(now - REFRESH_AFTER_MS + 1000) }, now), false);
  assert.equal(needsRefresh({ checkedAt: iso(now - REFRESH_AFTER_MS) }, now), true);
  assert.equal(needsRefresh({ checkedAt: iso(now - REFRESH_AFTER_MS), checkingSince: iso(now - 1000) }, now), false);
  // A check that never finished stops holding the next one back.
  assert.equal(needsRefresh({ checkedAt: iso(now - REFRESH_AFTER_MS), checkingSince: iso(now - CHECKING_WINDOW_MS) }, now), true);
});

test('the cache lives in the user cache folder, reads a broken file as empty and keeps the last release when offline', async t => {
  const on = env => ({ ...env, GITIFACT_NO_UPDATE_CHECK: '0' });
  assert.equal(userCacheDirectory({ GITIFACT_CACHE_DIR: 'X' }), 'X');
  assert.equal(userCacheDirectory({ LOCALAPPDATA: 'C:\\L' }, 'win32', 'C:\\H'), join('C:\\L', 'gitifact'));
  assert.equal(userCacheDirectory({}, 'darwin', '/h'), join('/h', 'Library', 'Caches', 'gitifact'));
  assert.equal(userCacheDirectory({ XDG_CACHE_HOME: '/x' }, 'linux', '/h'), join('/x', 'gitifact'));
  assert.equal(userCacheDirectory({}, 'linux', '/h'), join('/h', '.cache', 'gitifact'));
  const f = fixture(t);
  assert.deepEqual(await readUpdateCache(f.env), {});
  writeCache(f, '{not json');
  writeFileSync(cacheFile(f), '{not json');
  assert.deepEqual(await readUpdateCache(f.env), {});
  writeCache(f, { checkedAt: 'yesterday', latest: 5, later: { version: '0.8.4' } });
  assert.deepEqual(await readUpdateCache(f.env), {});
  await recordUpdateCheck(f.env, { status: 'available', latestVersion: '0.8.4' }, now);
  assert.deepEqual(await readUpdateCache(f.env), { checkedAt: iso(now), latest: '0.8.4' });
  await recordUpdateCheck(f.env, { status: 'unavailable', latestVersion: null }, now + 1);
  assert.deepEqual(await readUpdateCache(f.env), { checkedAt: iso(now + 1), latest: '0.8.4' });
  await recordUpdateCheck(f.env, { status: 'disabled', latestVersion: null }, now + 2);
  assert.equal((await readUpdateCache(f.env)).checkedAt, iso(now + 1));
  // The detached check keeps its answer and clears the mark that it was running.
  writeCache(f, { checkingSince: iso(now) });
  await refreshUpdateCache('0.8.3', on(f.env), async () => '0.8.5', () => now + 3);
  assert.deepEqual(await readUpdateCache(f.env), { checkedAt: iso(now + 3), latest: '0.8.5' });
  let asked = 0;
  await refreshUpdateCache('0.8.3', { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, async () => { asked++; return '9.9.9'; });
  assert.equal(asked, 0);
});

test('the notice before a command reads only local files and starts the check in the background', async t => {
  const f = fixture(t);
  const lines = []; let started = 0;
  const on = { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0' };
  const notice = (command, env = on, time = now) => noticeVersion('0.8.3', command, { cwd: f.repo, env, now: time, refresh: () => { started++; }, write: line => lines.push(line) });
  // No cache yet: nothing to say, and one check starts, marked so another command does not start a second.
  await notice('specs');
  assert.deepEqual([lines, started], [[], 1]);
  assert.equal((await readUpdateCache(f.env)).checkingSince, iso(now));
  await notice('specs', on, now + 1000);
  assert.equal(started, 1);
  // The answer arrives; the next command tells of it, from a folder below the project too.
  await recordUpdateCheck(f.env, { status: 'available', latestVersion: '0.8.4' }, now);
  await notice('specs');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /0\.8\.4/);
  // init and update check the registry themselves, so they start no background check.
  writeCache(f, {});
  await notice('update'); await notice('init');
  assert.equal(started, 1);
  await recordUpdateCheck(f.env, { status: 'available', latestVersion: '0.8.4' }, now);
  // A project set to a newer release comes first; one set to an older release comes after the release notice.
  setProject(f, '0.8.5');
  mkdirSync(join(f.repo, 'deep'));
  await noticeVersion('0.8.3', 'specs', { cwd: join(f.repo, 'deep'), env: on, now, refresh: () => { started++; }, write: line => lines.push(line) });
  assert.match(lines.at(-1), /gitifact 0\.8\.5 기준/);
  // GITIFACT_NO_UPDATE_CHECK stops the release check and its notice; the local project comparison stays.
  setProject(f, '0.8.2');
  const quiet = { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' };
  await notice('specs', quiet, now + 2 * REFRESH_AFTER_MS);
  assert.match(lines.at(-1), /프로젝트 기준\(0\.8\.2\)보다 새 버전/);
  assert.equal(started, 1);
  // A broken config or cache never stops the command it precedes.
  writeFileSync(join(f.repo, '.gitifact/config.json'), '{broken');
  writeFileSync(cacheFile(f), '{broken');
  await notice('specs');
});

test('update --later quiets the announced release for a day and says when nothing is known', async t => {
  const f = fixture(t);
  assert.deepEqual(await postponeRelease('0.8.3', f.env, now), { contract: 'update-later', version: 1, ok: true, cliVersion: '0.8.3', later: null });
  assert.equal(existsSync(cacheFile(f)), false);
  await recordUpdateCheck(f.env, { status: 'available', latestVersion: '0.8.4' }, now);
  const later = updateLaterV1.parse(await postponeRelease('0.8.3', f.env, now));
  assert.deepEqual(later.later, { version: '0.8.4', until: iso(now + LATER_MS) });
  assert.deepEqual((await readUpdateCache(f.env)).later, later.later);
  // Nothing newer than the running CLI is known: nothing to quiet.
  assert.equal((await postponeRelease('0.8.4', f.env, now)).later, null);
});

test('the built CLI puts the notice on stderr before the output, keeps JSON intact and refreshes in a detached process', async t => {
  const f = fixture(t);
  const preload = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = async () => new Response(JSON.stringify({"dist-tags":{"latest":"99.0.0"}}));');
  const cli = (args, extra = {}) => spawnSync(process.execPath, ['--import', preload, entry, ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '0', ...extra }, encoding: 'utf8', timeout: 35000 });
  const first = cli(['guide', 'list', '--format', 'json']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stderr, '');
  JSON.parse(first.stdout);
  // The command returned without waiting; the detached check writes the cache on its own and ends.
  let cache = {};
  for (let tries = 0; tries < 100 && cache.latest !== '99.0.0'; tries++) { await delay(100); cache = await readUpdateCache(f.env); }
  assert.equal(cache.latest, '99.0.0');
  assert.equal(cache.checkingSince, undefined);
  const second = cli(['guide', 'list', '--format', 'json']);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, new RegExp('^새 버전 99\\.0\\.0가 있습니다\\(지금 ' + version.replaceAll('.', '\\.') + '\\)\\. .*gitifact update --later\\n$'));
  JSON.parse(second.stdout);
  // The answer is fresh, so no second check starts for an hour.
  assert.equal((await readUpdateCache(f.env)).checkingSince, undefined);
  // --later through the CLI: the contract, then quiet.
  const later = cli(['update', '--later']);
  assert.equal(later.status, 0, later.stderr);
  assert.equal(updateLaterV1.parse(JSON.parse(later.stdout)).later.version, '99.0.0');
  assert.equal(cli(['guide', 'list']).stderr, '');
  assert.match(cli(['update', '--later', '--format', 'text']).stdout, /99\.0\.0 안내를 .*까지 쉽니다/);
  for (const args of [['--later', '--check'], ['--later', '--commit']]) assert.notEqual(cli(['update', ...args]).status, 0);
  // The detached check is hidden from help.
  assert.doesNotMatch(cli(['--help']).stdout, /__refresh-update/);
});
