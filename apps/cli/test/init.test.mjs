import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { fixture, fingerprint } from './git-fixture.mjs';

const path = f => join(f.repo, '.gitifact', 'config.json');
const init = (f, options = {}, cwd = f.repo, hook) => initializeSpecProject(cwd, !!options.dryRun, f.env, hook);
const preserved = (before, after) => { for (const [key, value] of Object.entries(before)) assert.equal(after[key], value, key); };

test('dry-run is read-only; unborn init is complete, repeatable and preserves bytes', async t => {
  const f = fixture(t); f.write('work.txt', 'untouched');
  const before = fingerprint(f.repo);
  assert.equal((await init(f, { dryRun: true })).outcome, 'planned');
  assert.deepEqual(fingerprint(f.repo), before);
  const created = await init(f);
  assert.equal(created.outcome, 'created'); assert.equal(created.version, 7); assert.deepEqual(created.baseline, { kind: 'empty' });
  assert.deepEqual(created.agentDocs, { mode: 'skip', paths: [] });
  preserved(before, fingerprint(f.repo));
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')), ['config.json']);
  const bytes = readFileSync(path(f));
  assert.equal((await init(f)).outcome, 'already-initialized');
  assert.deepEqual(readFileSync(path(f)), bytes);
});

test('agent docs block is planned, created, refreshed and removed through init', async t => {
  const f = fixture(t); f.write('CLAUDE.md', '# Team\n\nRules.\n');
  // The block body ships as Markdown beside the built entry point, so this reads the source instead.
  const source = readFileSync(fileURLToPath(new URL('../src/shared/i18n/ko/block.md', import.meta.url)), 'utf8');
  const docs = (extra = {}) => ({ version: '0.0.0-test', readBlock: async () => source, ...extra });
  const run = (repo, dryRun, options) => initializeSpecProject(repo.repo, dryRun, repo.env, undefined, options);
  const before = fingerprint(f.repo);
  const planned = await run(f, true, docs());
  assert.deepEqual([planned.outcome, planned.agentDocs], ['planned', { mode: 'install', paths: ['CLAUDE.md'] }]);
  assert.deepEqual(fingerprint(f.repo), before);
  const created = await run(f, false, docs());
  assert.deepEqual([created.outcome, created.agentDocs.paths], ['created', ['CLAUDE.md']]);
  const text = readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8');
  assert.match(text, /^# Team\n\nRules\.\n\n<!-- GITIFACT:START -->\n## Gitifact Guide\n\ngitifact v0\.0\.0-test /);
  assert.equal(existsSync(join(f.repo, 'AGENTS.md')), false);
  const again = await run(f, false, docs({ version: '0.0.1-test' }));
  assert.equal(again.outcome, 'already-initialized');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), text.replaceAll('0.0.0-test', '0.0.1-test'));
  assert.equal((await run(f, true, docs({ version: '0.0.2-test' }))).outcome, 'already-initialized');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), text.replaceAll('0.0.0-test', '0.0.1-test'));
  const removed = await run(f, false, docs({ remove: true }));
  assert.deepEqual(removed.agentDocs, { mode: 'remove', paths: ['CLAUDE.md'] });
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '# Team\n\nRules.\n');
  const g = fixture(t); g.write('AGENTS.md', '<!-- GITIFACT:START -->\nbroken\n');
  const untouched = fingerprint(g.repo);
  await assert.rejects(run(g, false, docs()), { code: 'AGENT_DOCS_MALFORMED' });
  assert.deepEqual(fingerprint(g.repo), untouched);
  assert.equal(existsSync(join(g.repo, '.gitifact')), false);
});

test('SHA-1 and SHA-256 baselines survive new commits and detached subdirectory execution', async t => {
  for (const format of ['sha1', 'sha256']) {
    const f = fixture(t, format); f.write('a', 'first'); f.commit();
    const head = f.git(['rev-parse', 'HEAD']).stdout.trim();
    f.git(['checkout', '--detach']); mkdirSync(join(f.repo, 'sub'));
    f.write('a', 'staged'); f.git(['add', 'a']); f.write('a', 'unstaged');
    const before = fingerprint(f.repo);
    const result = await init(f, {}, join(f.repo, 'sub'));
    assert.equal(result.baseline.commit, head); assert.equal(result.baseline.objectFormat, format);
    preserved(before, fingerprint(f.repo));
    f.commit('adoption');
    const bytes = readFileSync(path(f));
    assert.equal((await init(f)).baseline.commit, head);
    assert.deepEqual(readFileSync(path(f)), bytes);
  }
});

test('ignore rules, tracked deletion, legacy and malformed files never overwrite data', async t => {
  const f = fixture(t);
  assert.equal((await init(f, { dryRun: true })).schemaVersion, 3);
  assert.equal(existsSync(join(f.repo, '.gitifact')), false);
  f.write('.gitignore', '.gitifact/\n');
  await assert.rejects(init(f), { code: 'CONFIG_IGNORED' });
  assert.equal(existsSync(join(f.repo, '.gitifact')), false);
  f.write('.gitignore', '.gitifact/*\n!.gitifact/config.json\n');
  await init(f); f.commit(); unlinkSync(path(f));
  const before = fingerprint(f.repo);
  await assert.rejects(init(f), { code: 'CONFIG_DELETED' });
  assert.deepEqual(fingerprint(f.repo), before);
  for (const [text, code] of [['{', 'INVALID_CONFIG'], [JSON.stringify({ kind: 'tryce-project', format: 'init-99' }), 'UNSUPPORTED_FORMAT'],
    [JSON.stringify({ kind: 'tryce-project', format: 'init-1', mode: 'normal', baseline: { kind: 'empty' } }), 'UNSUPPORTED_FORMAT']]) {
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
  symlinkSync(target, join(f.repo, '.gitifact'), 'junction');
  await assert.rejects(init(f), { code: 'PATH_CONFLICT' });
  assert.deepEqual(readdirSync(target), []);
  // Junction cleanup stays within the temporary fixture and removes only the link.
  const { rmdirSync } = await import('node:fs'); rmdirSync(join(f.repo, '.gitifact'));
  await init(f);
  const config = JSON.parse(readFileSync(path(f), 'utf8'));
  config.baseline.commit = 'f'.repeat(40); writeFileSync(path(f), JSON.stringify(config));
  await assert.rejects(init(f), { code: 'BASELINE_UNAVAILABLE' });
  assert.equal(JSON.parse(readFileSync(path(f), 'utf8')).baseline.commit, 'f'.repeat(40));
});

test('parallel init publishes one config', async t => {
  const f = fixture(t);
  const results = await Promise.all([init(f), init(f)]);
  assert.deepEqual(results.map(r => r.outcome).sort(), ['already-initialized', 'created']);
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')), ['config.json']);
  assert.equal(JSON.parse(readFileSync(path(f), 'utf8')).schemaVersion, 3);
  // Both runs wanted the reason file's merge rule; it is there once.
  assert.equal(readFileSync(join(f.repo, '.gitattributes'), 'utf8'), '/.gitifact/history.jsonl merge=union\n');
});

// What `gitifact init` of 0.4.x wrote. Earlier conventions are no longer converted, even when nothing is beside the config.
const legacyConfig = '{\n  "schemaVersion": 1,\n  "baseline": {\n    "kind": "empty"\n  }\n}\n';

test('an earlier or a newer convention is refused and left as it is', async t => {
  const f = fixture(t); mkdirSync(join(f.repo, '.gitifact'));
  writeFileSync(path(f), legacyConfig);
  await assert.rejects(init(f, { dryRun: true }), error => error.code === 'UNSUPPORTED_SCHEMA' && /schemaVersion 1/.test(error.message));
  await assert.rejects(init(f), { code: 'UNSUPPORTED_SCHEMA' });
  assert.equal(readFileSync(path(f), 'utf8'), legacyConfig);
  const g = fixture(t); mkdirSync(join(g.repo, '.gitifact'));
  const newer = '{"schemaVersion":4,"baseline":{"kind":"empty"}}';
  writeFileSync(path(g), newer);
  await assert.rejects(init(g), error => error.code === 'UNSUPPORTED_SCHEMA' && /더 새로운 저장 규약/.test(error.message));
  assert.equal(readFileSync(path(g), 'utf8'), newer);
  // The 0.7 convention is the one a migration starts from: the refusal points at the migration prompt.
  const h = fixture(t); mkdirSync(join(h.repo, '.gitifact'));
  const previous = '{"schemaVersion":2,"baseline":{"kind":"empty"}}';
  writeFileSync(path(h), previous);
  await assert.rejects(init(h), error => error.code === 'UNSUPPORTED_SCHEMA' && /마이그레이션 프롬프트/.test(error.message));
  assert.equal(readFileSync(path(h), 'utf8'), previous);
});

test('init reports the registry check it was given and how to install a newer release', async t => {
  const f = fixture(t);
  const newer = await initializeSpecProject(f.repo, true, f.env, undefined, undefined, undefined, Promise.resolve({ status: 'available', latestVersion: '9.9.9' }));
  assert.deepEqual([newer.update, newer.install], [{ status: 'available', latestVersion: '9.9.9' }, { npx: 'npx --yes gitifact@9.9.9 update', npmGlobal: 'npm install -g gitifact@9.9.9' }]);
  const plain = await init(f);
  assert.deepEqual([plain.update, plain.install], [{ status: 'disabled', latestVersion: null }, null]);
});

test('input changes and injected failure leave user files intact and permit retry', async t => {
  const f = fixture(t); f.write('a', 'original'); f.commit();
  await assert.rejects(init(f, {}, f.repo, async () => { f.write('a', 'new'); f.git(['add', 'a']); }), { code: 'INPUT_CHANGED' });
  assert.equal(existsSync(path(f)), false); assert.equal(readFileSync(join(f.repo, 'a'), 'utf8'), 'new');
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')), []);
  await assert.rejects(init(f, {}, f.repo, async () => { throw new Error('disk failure'); }), /disk failure/);
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')), []);
  assert.equal((await init(f)).outcome, 'created');
});

test('a concurrently created user config is refused and preserved', async t => {
  const f = fixture(t);
  const text = '{"schemaVersion":2,"baseline":{"kind":"empty"}}';
  // The record check runs before the config check, so a config that appears mid-run is treated as unadopted data.
  await assert.rejects(init(f, {}, f.repo, async () => { writeFileSync(path(f), text); }), { code: 'EXISTING_RECORDS' });
  assert.equal(readFileSync(path(f), 'utf8'), text);
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')), ['config.json']);
});

test('linked worktree initialization preserves the other checkout and shared Git data', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit();
  const other = join(f.root, 'other'); f.git(['worktree', 'add', '-b', 'other', other]);
  const before = fingerprint(f.repo);
  assert.equal((await init(f, {}, other)).outcome, 'created');
  assert.deepEqual(fingerprint(f.repo), before);
  assert.equal(existsSync(join(f.repo, '.gitifact')), false);
});

test('built command has versioned output and rejects removed options before writing', t => {
  const f = fixture(t);
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  // The registry check is switched off: tests never contact npm.
  const cli = args => spawnSync(process.execPath, [entry, 'init', ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 35000 });
  const removed = cli(['--mode', 'prototype']); assert.equal(removed.status, 1); assert.equal(existsSync(join(f.repo, '.gitifact')), false);
  const planned = cli(['--dry-run']); assert.equal(planned.status, 0); assert.equal(JSON.parse(planned.stdout).schemaVersion, 3);
  const good = cli([]); assert.equal(good.status, 0, good.stderr);
  const dto = JSON.parse(good.stdout); assert.equal(dto.contract, 'project-init'); assert.equal(dto.outcome, 'created');
});

test('process termination before and after publication recovers without deleting unknown leftovers', async t => {
  const f = fixture(t);
  const moduleUrl = new URL('../.test-build/commands/spec-init.js', import.meta.url).href;
  const run = source => spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  const prefix = `import { initializeSpecProject } from ${JSON.stringify(moduleUrl)};`;
  const before = run(prefix + `await initializeSpecProject(process.cwd(), false, process.env, async () => process.exit(23));`);
  assert.equal(before.status, 23, before.stderr);
  assert.equal(existsSync(path(f)), false);
  const leftovers = readdirSync(join(f.repo, '.gitifact'));
  assert.equal(leftovers.length, 1);
  const bytes = readFileSync(join(f.repo, '.gitifact', leftovers[0]));
  const after = run(prefix + `await initializeSpecProject(process.cwd()); process.exit(24);`);
  assert.equal(after.status, 24, after.stderr);
  assert.equal((await init(f)).outcome, 'already-initialized');
  assert.deepEqual(readFileSync(join(f.repo, '.gitifact', leftovers[0])), bytes);
});

test('clone and submodule use their own tracked config and preserve source checkout', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit(); await init(f); f.commit('init');
  const before = fingerprint(f.repo);
  const clone = join(f.root, 'clone'); f.git(['clone', '--no-hardlinks', f.repo, clone], f.root);
  assert.equal((await init(f, {}, clone)).outcome, 'already-initialized');
  const host = join(f.root, 'host'); mkdirSync(host); f.git(['init', '--template=', '-b', 'main'], host);
  f.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', f.repo, 'module'], host);
  assert.equal((await init(f, {}, join(host, 'module'))).outcome, 'already-initialized');
  assert.equal(existsSync(join(host, '.gitifact')), false);
  assert.deepEqual(fingerprint(f.repo), before);
});

test('partial staging of existing config is preserved without rewriting either version', async t => {
  const f = fixture(t); f.write('a', 'a'); f.commit(); await init(f); f.commit('init');
  const config = JSON.parse(readFileSync(path(f), 'utf8'));
  writeFileSync(path(f), JSON.stringify(config)); f.git(['add', '.gitifact/config.json']);
  writeFileSync(path(f), JSON.stringify(config, null, 4) + '\n');
  const before = fingerprint(f.repo);
  assert.equal((await init(f)).outcome, 'already-initialized');
  assert.deepEqual(fingerprint(f.repo), before);
});

test('init adds the union merge rule for the reason file once, in the file\'s own line endings', async t => {
  const rule = '/.gitifact/history.jsonl merge=union';
  const attributes = f => readFileSync(join(f.repo, '.gitattributes'), 'utf8');
  // No .gitattributes yet: dry-run writes nothing, init creates the file with the one rule, and a second run leaves it.
  const f = fixture(t);
  await init(f, { dryRun: true }); assert.equal(existsSync(join(f.repo, '.gitattributes')), false);
  await init(f); assert.equal(attributes(f), rule + '\n');
  await init(f); assert.equal(attributes(f), rule + '\n');
  // An existing CRLF file without a final newline gets the rule on a line of its own, in CRLF.
  const g = fixture(t); g.write('.gitattributes', '* text=auto\r\n*.png binary');
  await init(g); assert.equal(attributes(g), '* text=auto\r\n*.png binary\r\n' + rule + '\r\n');
  // A rule already there, written another way, is left as it is.
  const h = fixture(t); const own = '.gitifact/history.jsonl  -diff merge=union\n'; h.write('.gitattributes', own);
  await init(h); assert.equal(attributes(h), own);
  // A project adopted before the rule existed gets it from a re-run.
  const k = fixture(t); await init(k); unlinkSync(join(k.repo, '.gitattributes'));
  assert.equal((await init(k)).outcome, 'already-initialized'); assert.equal(attributes(k), rule + '\n');
});
