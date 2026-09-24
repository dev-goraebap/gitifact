import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
const cli = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const call = (f, args, ok = true) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 35000 });
  assert.equal(r.status, ok ? 0 : 1, r.stderr); return ok ? JSON.parse(r.stdout) : r;
};
const legacyConfig = JSON.stringify({ kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: { kind: 'empty' } }, null, 2) + '\n';
test('spec init dry-run, repeat and agent docs block preserve existing work and staging', async t => {
  const f = fixture(t); f.write('work', 'user work'); f.git(['add', 'work']);
  const before = fingerprint(f.repo);
  const planned = call(f, ['init', '--dry-run']);
  assert.deepEqual([planned.outcome, planned.agentDocs], ['planned', { mode: 'install', paths: ['AGENTS.md', 'CLAUDE.md'] }]); assert.deepEqual(fingerprint(f.repo), before);
  assert.equal(call(f, ['init']).schemaVersion, 3);
  const config = readFileSync(join(f.repo, '.gitifact/config.json'), 'utf8');
  assert.equal(JSON.parse(config).mode, undefined);
  const agents = readFileSync(join(f.repo, 'AGENTS.md'), 'utf8');
  assert.match(agents, /^# AGENTS\.md\n\nProject-specific guidance for AI coding agents\.\n\n<!-- GITIFACT:START -->\n## Gitifact Guide\n\ngitifact v\d+\.\d+\.\d+/);
  assert.match(agents, /<!-- GITIFACT:END -->\n$/);
  assert.equal(call(f, ['init']).outcome, 'already-initialized'); assert.equal(readFileSync(join(f.repo, '.gitifact/config.json'), 'utf8'), config);
  assert.equal(readFileSync(join(f.repo, 'AGENTS.md'), 'utf8'), agents);
  assert.equal(f.git(['diff', '--cached', '--name-only']).stdout.trim(), 'work');
  assert.equal(readFileSync(join(f.repo, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.deepEqual(call(f, ['init', '--remove-agents']).agentDocs, { mode: 'remove', paths: ['AGENTS.md', 'CLAUDE.md'] });
  assert.equal(existsSync(join(f.repo, 'CLAUDE.md')), false);
  assert.equal(existsSync(join(f.repo, 'AGENTS.md')), false);
  assert.equal(call(f, ['init', '--remove-agents', '--skip-agents'], false).status, 1);
  const g = fixture(t);
  assert.deepEqual(call(g, ['init', '--skip-agents']).agentDocs, { mode: 'skip', paths: [] });
  assert.equal(existsSync(join(g.repo, 'AGENTS.md')), false);
  assert.deepEqual(call(g, ['init', '--agent', 'claude']).agentDocs, { mode: 'install', paths: ['.claude/CLAUDE.md'] });
  assert.match(readFileSync(join(g.repo, '.claude/CLAUDE.md'), 'utf8'), /^# CLAUDE\n/);
});
test('init refuses legacy records and malformed config without mutation', async t => {
  const f = fixture(t); mkdirSync(join(f.repo, '.gitifact')); f.write('.gitifact/config.json', legacyConfig);
  const before = fingerprint(f.repo); assert.match(call(f, ['init'], false).stderr, /UNSUPPORTED_FORMAT/); assert.deepEqual(fingerprint(f.repo), before);
  f.write('.gitifact/config.json', '{}'); const invalid = fingerprint(f.repo); call(f, ['init'], false); assert.deepEqual(fingerprint(f.repo), invalid);
});
test('init writes no document, and the documents check accepts the new project', async t => {
  const f = fixture(t); call(f, ['init', '--skip-agents']);
  assert.deepEqual(readdirSync(join(f.repo, '.gitifact')).sort(), ['config.json']);
  const check = spawnSync(process.execPath, [cli, 'check'], { cwd: f.repo, env: { ...f.env, GITIFACT_LANG: 'ko' }, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr); assert.equal(check.stdout, '문제 없음 (문서 0개)\n');
});
test('interrupted init before publication cleans temp and can retry', async t => {
  const f = fixture(t);
  await assert.rejects(initializeSpecProject(f.repo, false, f.env, async () => { throw new Error('injected'); }), /injected/);
  assert.equal(existsSync(join(f.repo,'.gitifact/config.json')), false);
  assert.equal((await initializeSpecProject(f.repo, false, f.env)).outcome, 'created');
});
test('new init rejects orphan data and ignored settings', t => {
  const f = fixture(t); mkdirSync(join(f.repo,'.gitifact')); f.write('.gitifact/orphan.json','{}');
  const before = fingerprint(f.repo); call(f,['init'],false); assert.deepEqual(fingerprint(f.repo),before);
  const other = fixture(t); other.write('.gitignore','.gitifact/\n'); call(other,['init'],false); assert.equal(existsSync(join(other.repo,'.gitifact')),false);
});

