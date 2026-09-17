import assert from 'node:assert/strict';
import test from 'node:test';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { RepositoryReadError } from '@gitifact/core';
import { browserSessionV2, changelogV1, repositoryStatusV1 } from '@gitifact/contracts';
import { startBrowserServer } from '../.test-build/server/browser-server.js';
import { createStatusSession } from '../.test-build/server/status-session.js';
import { fixture, fingerprint } from './git-fixture.mjs';

const assetsDirectory = fileURLToPath(new URL('../dist/browser/', import.meta.url));
const sample = () => ({
  contract: 'repository-status', version: 1, ok: true,
  observation: { id: '8b2e8911-aa57-4fc1-8e72-65316f0e4c40', startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: '2026-09-13T00:00:01.000Z', consistency: 'best-effort' },
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64), rootPath: '/repo', objectFormat: 'sha1' },
  head: { state: 'unborn', branch: 'main', commit: null }, changes: [],
  summary: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
  checks: { state: 'not-run', reason: 'git-status-only' },
});
const headers = server => ({ 'X-Gitifact-Session': server.session.sessionId, Origin: server.url });

test('real HTTP reads cached status, refreshes Git and serves only bundled browser files', async (t) => {
  const f = fixture(t);
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory });
  try {
    const session = browserSessionV2.parse(await (await fetch(server.url + '/api/v1/session')).json());
    assert.equal(session.sessionId, server.session.sessionId);
    const first = await (await fetch(server.url + '/api/v1/status', { headers: headers(server) })).json();
    f.write('new.txt', 'changed\n');
    const before = fingerprint(f.repo);
    const cached = await (await fetch(server.url + '/api/v1/status', { headers: headers(server) })).json();
    assert.equal(cached.observation.id, first.observation.id);
    assert.deepEqual(cached.changes, []);
    const response = await fetch(server.url + '/api/v1/status/refresh', { method: 'POST', headers: headers(server) });
    assert.equal(response.status, 200);
    const fresh = repositoryStatusV1.parse(await response.json());
    assert.equal(fresh.ok, true);
    assert.notEqual(fresh.observation.id, first.observation.id);
    assert.equal(fresh.changes[0].path, 'new.txt');
    assert.deepEqual(fingerprint(f.repo), before);
    for (const route of ['/', '/about', '/missing']) {
      const page = await fetch(server.url + route, { headers: { Accept: 'text/html' } });
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      const html = await page.text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
      assert.ok(assets.length >= 2);
      for (const asset of assets) {
        const content = await fetch(server.url + asset);
        assert.equal(content.status, 200);
        assert.ok((await content.text()).length > 0);
      }
    }
    for (const path of ['/api/missing', '/assets/missing.js', '/package.json', '/.git/config', '/assets/../../.git/config']) {
      const response = await fetch(server.url + path, { headers: { Accept: 'text/html' } });
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type'), /application\/json/);
    }
  } finally { await server.close(); }
});

test('invalid Host, Origin, session, method, query and body cannot trigger Git', async () => {
  let reads = 0;
  const server = await startBrowserServer({ cwd: '/unused', assetsDirectory, readStatus: async () => { reads++; return sample(); } });
  try {
    const cases = [
      ['/api/v1/session', { headers: { Host: 'evil.example' } }, 403],
      ['/api/v1/session', { headers: { Origin: 'https://evil.example' } }, 403],
      ['/api/v1/session', { headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
      ['/api/v1/status', {}, 409],
      ['/api/v1/status', { headers: { 'X-Gitifact-Session': 'wrong' } }, 409],
      ['/api/v1/status?path=elsewhere', { headers: headers(server) }, 400],
      ['/api/v1/status', { method: 'POST', headers: headers(server) }, 405],
      ['/api/v1/status/refresh', { method: 'POST', headers: { 'X-Gitifact-Session': server.session.sessionId } }, 403],
      ['/api/v1/status/refresh', { method: 'POST', headers: headers(server), body: '{}' }, 400],
      ['/api/v1/status/refresh', { method: 'OPTIONS' }, 405],
      ['/%00', {}, 400], ['/assets/%', {}, 400],
    ];
    for (const [path, options, status] of cases) {
      const actual = await new Promise((resolve, reject) => {
        const req = request(server.url + path, options, response => {
          response.resume(); resolve(response.statusCode);
        });
        req.on('error', reject);
        if (options.body) req.setHeader('Content-Length', Buffer.byteLength(options.body));
        req.end(options.body);
      });
      assert.equal(actual, status, path);
    }
    assert.equal(reads, 1);
  } finally { await server.close(); }
});

test('only explicitly enabled Vite Origin can refresh', async () => {
  for (const dev of [false, true]) {
    const server = await startBrowserServer({ cwd: '/unused', assetsDirectory, dev, readStatus: async () => sample() });
    try {
      const response = await fetch(server.url + '/api/v1/status/refresh', {
        method: 'POST', headers: { ...headers(server), Origin: 'http://127.0.0.1:5173' },
      });
      assert.equal(response.status, dev ? 200 : 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    } finally { await server.close(); }
  }
});

test('overlapping refresh calls share one observation and preserve failures', async () => {
  let finish;
  let reads = 0;
  const initial = sample();
  const store = createStatusSession(initial, () => { reads++; return new Promise(resolve => { finish = resolve; }); });
  const first = store.refresh(); const second = store.refresh();
  assert.equal(first, second);
  assert.equal(reads, 1);
  assert.equal(store.latest, initial);
  const next = { ...sample(), observation: { ...initial.observation, id: '6d8613d1-7fdf-4788-9691-d3a5bd45b19d' } };
  finish(next);
  assert.equal(await first, next); assert.equal(await second, next);
  assert.equal(store.latest, next);
  const failures = createStatusSession(sample(), async () => { throw new RepositoryReadError('GIT_FAILED'); });
  assert.equal((await failures.refresh()).error.code, 'GIT_FAILED');
  assert.equal(failures.latest.ok, false);
  const wrong = createStatusSession(sample(), async () => ({ ...sample(), repository: { ...sample().repository, worktreeKey: 'worktree:' + 'c'.repeat(64) } }));
  assert.equal((await wrong.refresh()).error.code, 'REPOSITORY_CHANGED');
});

test('failed refresh returns 503 on POST and subsequent GET', async () => {
  let reads = 0;
  const server = await startBrowserServer({ cwd: '/unused', assetsDirectory, readStatus: async () => {
    if (reads++ === 0) return sample();
    throw new RepositoryReadError('GIT_FAILED');
  } });
  try {
    for (const method of ['POST', 'GET']) {
      const response = await fetch(server.url + '/api/v1/status' + (method === 'POST' ? '/refresh' : ''), { method, headers: headers(server) });
      assert.equal(response.status, 503);
      assert.equal(repositoryStatusV1.parse(await response.json()).error.code, 'GIT_FAILED');
    }
    assert.equal(reads, 2);
  } finally { await server.close(); }
});

test('shutdown aborts active reads and releases the port', async () => {
  let reads = 0;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const server = await startBrowserServer({ cwd: '/unused', assetsDirectory, readStatus: async (signal) => {
    if (reads++ === 0) return sample();
    started();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const response = fetch(server.url + '/api/v1/status/refresh', { method: 'POST', headers: headers(server) }).catch(() => undefined);
  await entered;
  await server.close();
  await server.closed;
  await response;
  await assert.rejects(fetch(server.url));
  const replacement = await startBrowserServer({ cwd: '/unused', assetsDirectory, port: Number(new URL(server.url).port), readStatus: async () => sample() });
  await replacement.close();
});

test('occupied port fails without interrupting the existing server', async () => {
  const options = { cwd: '/unused', assetsDirectory, readStatus: async () => sample() };
  const server = await startBrowserServer(options);
  try {
    await assert.rejects(startBrowserServer({ ...options, port: Number(new URL(server.url).port) }), /사용 중/);
    assert.equal((await fetch(server.url + '/api/v1/session')).status, 200);
  } finally { await server.close(); }
});

test('session carries the CLI version and one background registry check, disabled unless a fetcher is given', async (t) => {
  const f = fixture(t);
  const quiet = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory, cliVersion: '0.4.0' });
  try {
    const session = browserSessionV2.parse(await (await fetch(quiet.url + '/api/v1/session')).json());
    assert.deepEqual([session.version, session.cliVersion, session.update], [2, '0.4.0', { status: 'disabled', latestVersion: null }]);
    assert.deepEqual(quiet.session, session);
  } finally { await quiet.close(); }
  let asked = 0; let answer;
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory, cliVersion: '0.4.0',
    fetchLatest: () => { asked++; return new Promise(resolve => { answer = resolve; }); } });
  try {
    // Startup did not wait for the registry, and re-reading the session never asks again.
    const read = async () => browserSessionV2.parse(await (await fetch(server.url + '/api/v1/session')).json());
    const first = await read();
    assert.deepEqual(first.update, { status: 'checking', latestVersion: null });
    assert.equal((await read()).sessionId, first.sessionId);
    answer('0.4.1');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual((await read()).update, { status: 'available', latestVersion: '0.4.1' });
    assert.equal(asked, 1);
  } finally { await server.close(); }
  for (const [fetchLatest, expected] of [[async () => '0.4.0', 'up-to-date'], [async () => { throw new Error('offline'); }, 'unavailable'],
    [async () => 'latest', 'unavailable'], [() => new Promise(() => {}), 'unavailable']]) {
    const other = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory, cliVersion: '0.4.0', fetchLatest, updateCheckTimeoutMs: 50 });
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal((await (await fetch(other.url + '/api/v1/session')).json()).update.status, expected);
    } finally { await other.close(); }
  }
  // Closing while the check is pending does not hang.
  const pending = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory, fetchLatest: signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await pending.close();
});

test('release notes are parsed per language with a fallback and never read outside the bundle', async (t) => {
  const f = fixture(t);
  const notes = { ko: '## 0.4.0 - 2026-09-17\n### Added\n- 패치노트 페이지\n### Removed\n- 옛 명령\n\n## 0.3.2 - 2026-09-17\n### Fixed\n- 오타\n' };
  const asked = [];
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory, readChangelog: async language => { asked.push(language); return notes[language] ?? null; } });
  try {
    const get = (query = '', extra = headers(server)) => fetch(server.url + '/api/v1/changelog' + query, { headers: extra });
    const own = changelogV1.parse(await (await get('?lang=ko')).json());
    assert.deepEqual([own.language, own.fallback, own.entries.map(entry => entry.version)], ['ko', false, ['0.4.0', '0.3.2']]);
    assert.deepEqual(own.entries[0], { version: '0.4.0', date: '2026-09-17', added: ['패치노트 페이지'], changed: [], removed: ['옛 명령'], fixed: [] });
    assert.deepEqual(changelogV1.parse(await (await get()).json()), own);
    const other = changelogV1.parse(await (await get('?lang=en')).json());
    assert.deepEqual([other.language, other.fallback, other.entries.length], ['ko', true, 2]);
    assert.deepEqual(asked, ['ko', 'ko', 'en', 'ko']);
    for (const query of ['?lang=../ko', '?lang=KO', '?lang=ko&lang=en', '?lang=ko&x=1', '?lang=']) assert.equal((await get(query)).status, 400, query);
    assert.equal((await get('?lang=ko', { Origin: server.url })).status, 409);
    assert.equal((await fetch(server.url + '/api/v1/changelog', { method: 'POST', headers: headers(server) })).status, 405);
    notes.ko = '## not a version\n';
    const broken = await get('?lang=ko');
    assert.equal(broken.status, 503);
    assert.equal((await broken.json()).error.code, 'INTERNAL_ERROR');
    delete notes.ko;
    assert.equal((await get('?lang=ko')).status, 404);
  } finally { await server.close(); }
  // The packaged notes are served by default and start with the package version.
  const { version } = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const built = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory,
    readChangelog: async language => (await import('node:fs/promises')).readFile(new URL('../dist/i18n/' + language + '/changelog.md', import.meta.url), 'utf8').catch(() => null) });
  try {
    const bundled = changelogV1.parse(await (await fetch(built.url + '/api/v1/changelog', { headers: headers(built) })).json());
    assert.equal(bundled.entries[0].version, version);
  } finally { await built.close(); }
});
