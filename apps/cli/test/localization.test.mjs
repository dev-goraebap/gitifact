import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { environmentLanguage, withLanguage, t as message } from '../.test-build/shared/i18n/index.js';
import { RepositoryReadError, parseChangelog } from '@gitifact/core';
import { startBrowserServer } from '../.test-build/server/browser-server.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = join(root, 'apps/cli/dist/main.js');
const version = JSON.parse(readFileSync(join(root, 'apps/cli/package.json'), 'utf8')).version;
function run(f, args, language = 'en', more = {}) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: f.repo,
    env: { ...f.env, GITIFACT_LANG: language, GITIFACT_NO_UPDATE_CHECK: '1', ...more }, encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error); return result;
}
function success(f, args, language, more) {
  const r = run(f, args, language, more); assert.equal(r.status, 0, r.stderr); return r.stdout;
}
test('all message catalogs have matching keys and placeholders', () => {
  const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const scope of ['apps/browser', 'apps/cli', 'packages/core']) {
    const read = lang => JSON.parse(readFileSync(join(root, scope, 'src/shared/i18n', lang, 'messages.json'), 'utf8'));
    const ko = read('ko'), en = read('en');
    assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort(), scope);
    for (const key of Object.keys(ko)) {
      assert.deepEqual(placeholders(en[key]), placeholders(ko[key]), scope + ':' + key);
      assert.doesNotMatch(en[key], /[가-힣]/, scope + ':' + key);
    }
  }
});
test('environment precedence, region tags, and unsupported locales', () => {
  assert.equal(environmentLanguage({ GITIFACT_LANG: 'ko', LC_ALL: 'en_US.UTF-8' }), 'ko');
  assert.equal(environmentLanguage({ LC_ALL: 'en_GB.UTF-8', LANG: 'ko_KR.UTF-8' }), 'en');
  assert.equal(environmentLanguage({ LC_MESSAGES: 'ko_KR.UTF-8', LANG: 'en_US' }), 'ko');
  for (const LANG of ['ko', 'ko-KR', 'KO_kr.UTF-8']) assert.equal(environmentLanguage({ LANG }), 'ko');
  for (const LANG of ['C', 'ja_JP.UTF-8', 'kok', 'en-US']) assert.equal(environmentLanguage({ LANG }), 'en');
});
test('CLI help, documentation and errors follow language without changing contracts', t => {
  const f = fixture(t);
  assert.match(success(f, ['--help']), /Output language/);
  assert.match(success(f, ['--lang', 'ko', '--help']), /출력 언어/);
  for (const lang of ['ko', 'en']) {
    for (const topic of ['workflow', 'spec', 'design', 'instructions', 'records', 'writing', 'commit']) {
      assert.equal(success(f, ['--lang', lang, 'guide', 'show', topic]), readFileSync(join(root, 'apps/cli/src/shared/i18n', lang, 'docs', topic + '.md'), 'utf8'));
    }
  }
  assert.match(success(f, ['guide', 'show', 'spec', '--lang=ko']), /title: 요구사항 형식/);
  assert.match(success(f, ['--lang=en', 'guide', 'show', 'instructions'], 'ko'), /title: Project instruction format/);
  assert.match(success(f, ['guide', 'show', 'spec'], '', { LC_ALL: 'ja_JP.UTF-8' }), /title: Requirement format/);
  assert.match(success(f, ['--lang', 'ko', 'guide', 'list']), /^spec +요구사항 형식 — /m);
  for (const args of [['--lang', 'ja', 'guide', 'list'], ['--lang'], ['--lang=']]) assert.notEqual(run(f, args).status, 0);
  const errors = ['ko', 'en'].map(lang => JSON.parse(run(f, ['--lang', lang, 'docs', 'list', '--format', 'json']).stderr));
  assert.equal(errors[0].error.code, errors[1].error.code);
  assert.match(errors[0].error.message, /[가-힣]/);
  assert.doesNotMatch(errors[1].error.message, /[가-힣]/);
});
test('updates preserve Korean blocks and records; explicit language changes only blocks', t => {
  const f = fixture(t);
  success(f, ['--lang', 'ko', 'init']);
  const agents = join(f.repo, 'AGENTS.md');
  const initial = readFileSync(agents, 'utf8').replace('v' + version, 'v0.6.2') + '\nUser instructions outside the block.\n';
  writeFileSync(agents, initial);
  const records = fingerprint(join(f.repo, '.gitifact'));
  success(f, ['update'], 'en');
  assert.ok(readFileSync(agents, 'utf8').includes(`v${version} · ko ·`));
  assert.ok(readFileSync(agents, 'utf8').endsWith('User instructions outside the block.\n'));
  success(f, ['init'], 'en');
  assert.match(readFileSync(agents, 'utf8'), /· ko ·/);
  success(f, ['--lang', 'en', 'update']);
  assert.ok(readFileSync(agents, 'utf8').includes(`v${version} · en · storage schemaVersion 3`));
  assert.ok(readFileSync(agents, 'utf8').endsWith('User instructions outside the block.\n'));
  assert.deepEqual(fingerprint(join(f.repo, '.gitifact')), records);
  assert.match(success(f, ['--lang', 'en', 'guide', 'show', 'instructions']), /title: Project instruction format/);
});
test('English setup ships complete assets and preserves user text', t => {
  const f = fixture(t);
  success(f, ['init']);
  assert.match(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), /· en ·/);
  assert.equal(existsSync(join(f.repo, '.gitifact/wiki')), false);
  // The CLI language changes labels and skeletons, never what the user wrote.
  success(f, ['docs', 'new', 'feature', 'original', '--title', '원래 기능', '--description', '사용자가 쓴 기능'], 'en');
  const created = JSON.parse(success(f, ['docs', 'new', 'requirement', 'original/first', '--title', '원래 요구사항', '--description', '사용자가 쓴 설명', '--format', 'json'], 'en'));
  assert.match(readFileSync(join(f.repo, created.path), 'utf8'), /\ntitle: 원래 요구사항\ndescription: 사용자가 쓴 설명\norder: 10\ndraft: true\n---\n\nAs \(a user\)/);
  const ko = JSON.parse(success(f, ['docs', 'show', created.id, '--format', 'json'], 'ko'));
  const en = JSON.parse(success(f, ['docs', 'show', created.id, '--format', 'json'], 'en'));
  assert.deepEqual(en.documents, ko.documents);
  assert.match(success(f, ['docs', 'list'], 'en'), /\(draft\)/); assert.match(success(f, ['docs', 'list'], 'ko'), /\(초안\)/);
  const notes = lang => parseChangelog(readFileSync(join(root, 'apps/cli/dist/i18n', lang, 'changelog.md'), 'utf8'));
  assert.deepEqual(notes('en').map(n => [n.version, n.date]), notes('ko').map(n => [n.version, n.date]));
  assert.deepEqual(readdirSync(join(root, 'apps/cli/dist/i18n/en/docs')).sort(), readdirSync(join(root, 'apps/cli/dist/i18n/ko/docs')).sort());
});
test('concurrent languages remain isolated, including core errors and cached failures', async t => {
  const errors = await Promise.all(['ko', 'en'].map(lang => withLanguage(lang, async () => {
    await new Promise(resolve => setTimeout(resolve, lang === 'ko' ? 10 : 1));
    return [message('server.internal'), new RepositoryReadError('GIT_FAILED').message];
  })));
  errors[0].forEach(value => assert.match(value, /[가-힣]/));
  errors[1].forEach(value => assert.doesNotMatch(value, /[가-힣]/));
  const f = fixture(t); let reads = 0;
  const server = await startBrowserServer({ cwd: f.repo, env: f.env, assetsDirectory: join(root, 'apps/cli/dist/browser'),
    readStatus: async () => { if (reads++ > 0) throw new RepositoryReadError('GIT_FAILED'); return f.status(); } });
  t.after(() => server.close());
  const request = (lang, path, method = 'GET') => fetch(server.url + path, { method,
    headers: { Origin: server.url, 'X-Gitifact-Session': server.session.sessionId, 'Accept-Language': lang } }).then(r => r.json());
  const guard = await Promise.all(['ko', 'en'].map(lang => request(lang, '/api/v1/missing')));
  assert.equal(guard[0].error.code, guard[1].error.code);
  assert.match(guard[0].error.message, /[가-힣]/);
  assert.doesNotMatch(guard[1].error.message, /[가-힣]/);
  await request('ko', '/api/v1/status/refresh', 'POST');
  const cached = await Promise.all(['ko', 'en'].map(lang => request(lang, '/api/v1/status')));
  assert.match(cached[0].error.message, /[가-힣]/);
  assert.doesNotMatch(cached[1].error.message, /[가-힣]/);
});
