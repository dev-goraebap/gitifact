import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
const cli = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const call = (f, args, ok = true) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: f.repo, env: { ...f.env, GITIFACT_NO_UPDATE_CHECK: '1' }, encoding: 'utf8', timeout: 35000 });
  assert.equal(r.status, ok ? 0 : 1, r.stderr); return ok ? JSON.parse(r.stdout) : r;
};
const input = (f, action, data) => { const path = join(f.root, 'input.json'); writeFileSync(path, JSON.stringify(data)); return call(f, ['spec', action, '--file', path]); };
const legacyConfig = JSON.stringify({ kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: { kind: 'empty' } }, null, 2) + '\n';
test('spec init dry-run, repeat and agent docs block preserve existing work and staging', async t => {
  const f = fixture(t); f.write('work', 'user work'); f.git(['add', 'work']);
  const before = fingerprint(f.repo);
  const planned = call(f, ['init', '--dry-run']);
  assert.deepEqual([planned.outcome, planned.agentDocs], ['planned', { mode: 'install', paths: ['AGENTS.md', 'CLAUDE.md'] }]); assert.deepEqual(fingerprint(f.repo), before);
  assert.equal(call(f, ['init']).schemaVersion, 2);
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
test('spec command writes and commits through initialized format', async t => {
  const f = fixture(t); f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']); f.git(['config', 'commit.gpgsign', 'false']); f.git(['config', 'core.autocrlf', 'false']);
  call(f, ['spec', 'working'], false); call(f, ['init', '--skip-agents']);
  const saved = input(f, 'save', { expected: call(f, ['spec', 'working']).stamp, operations: [{type:'create', feature:'posts', title:'게시물 관리'}, {type:'add',feature:'posts',title:'게시물 생성',body:'제목을 입력한다.'}] });
  const id = saved.results[1].id;
  // init also wrote the wiki policy page and the merge rule; the commit must select every pending file.
  const committed = input(f, 'commit', { expected: call(f, ['spec','changes']).expected, reasons:[{ requirements:[id], reason:'기능 도입'}],
    paths:['.gitattributes','.gitifact/config.json','.gitifact/wiki/README.md','.gitifact/spec/posts/requirements.md','.gitifact/spec/posts/history.jsonl'],
    message:'Add posts specification', authorization:{basis:'project-policy',evidence:'Isolated test policy'}});
  assert.equal(committed.outcome, 'committed');
  assert.equal(call(f, ['spec','read']).specs[0].requirements[0].id, id);
  assert.equal(f.git(['status','--porcelain']).stdout, '');
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

