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
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 35000 });
  assert.equal(r.status, ok ? 0 : 1, r.stderr); return ok ? JSON.parse(r.stdout) : r;
};
const input = (f, action, data) => { const path = join(f.root, 'input.json'); writeFileSync(path, JSON.stringify(data)); return call(f, ['spec', action, '--file', path]); };
test('spec init dry-run, repeat and skills install preserve existing work and staging', async t => {
  const f = fixture(t); f.write('work', 'user work'); f.git(['add', 'work']);
  const before = fingerprint(f.repo);
  assert.equal(call(f, ['init', '--dry-run']).outcome, 'planned'); assert.deepEqual(fingerprint(f.repo), before);
  assert.equal(call(f, ['init']).projectFormat, 'spec-1');
  const config = readFileSync(join(f.repo, '.tryce/config.json'), 'utf8');
  assert.equal(JSON.parse(config).mode, undefined);
  assert.equal(call(f, ['init']).outcome, 'already-initialized'); assert.equal(readFileSync(join(f.repo, '.tryce/config.json'), 'utf8'), config);
  assert.equal(call(f, ['skills', 'install', '--agent', 'claude']).outcome, 'installed');
  assert.equal(readFileSync(join(f.repo, '.agents/skills/tryce-workflow/SKILL.md'), 'utf8'), readFileSync(join(f.repo, '.claude/skills/tryce-workflow/SKILL.md'), 'utf8'));
  assert.equal(f.git(['diff', '--cached', '--name-only']).stdout.trim(), 'work');
});
test('init refuses legacy records, malformed config and deleted tracked config without mutation', async t => {
  const f = fixture(t); call(f, ['init', '--mode', 'auto']);
  const before = fingerprint(f.repo); assert.match(call(f, ['init'], false).stderr, /MIGRATION_REQUIRED/); assert.deepEqual(fingerprint(f.repo), before);
  assert.match(call(f, ['req', 'list']).contract, /requirements|workflow/);
  f.write('.tryce/config.json', '{}'); const invalid = fingerprint(f.repo); call(f, ['init'], false); assert.deepEqual(fingerprint(f.repo), invalid);
});
test('spec command writes, prepares and commits through initialized format', async t => {
  const f = fixture(t); f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']); f.git(['config', 'commit.gpgsign', 'false']); f.git(['config', 'core.autocrlf', 'false']);
  call(f, ['spec', 'working'], false); call(f, ['init']);
  const saved = input(f, 'save', { expected: call(f, ['spec', 'working']).stamp, operations: [{type:'create', feature:'posts', title:'게시물 관리'}, {type:'add',feature:'posts',title:'게시물 생성',body:'제목을 입력한다.'}] });
  const id = saved.results[1].id;
  const prepared = input(f, 'prepare', { expected: call(f, ['spec','changes']).expected, reasons:[{ requirements:[id], reason:'기능 도입'}] });
  const plan = input(f, 'commit-plan', {verification:prepared.verification, paths:['.tryce/config.json','.tryce/spec/posts/requirements.md','.tryce/spec/posts/history.jsonl'], message:'Add posts specification', authorization:{basis:'project-policy',evidence:'Isolated test policy'}});
  assert.equal(input(f, 'commit-apply', plan.plan).outcome, 'committed');
  assert.equal(call(f, ['spec','read']).specs[0].requirements[0].id, id);
  assert.equal(f.git(['status','--porcelain']).stdout, '');
});
test('interrupted init before publication cleans temp and can retry', async t => {
  const f = fixture(t);
  await assert.rejects(initializeSpecProject(f.repo, false, f.env, async () => { throw new Error('injected'); }), /injected/);
  assert.equal(existsSync(join(f.repo,'.tryce/config.json')), false);
  assert.equal((await initializeSpecProject(f.repo, false, f.env)).outcome, 'created');
});
test('new init rejects orphan data and ignored settings', t => {
  const f = fixture(t); mkdirSync(join(f.repo,'.tryce')); f.write('.tryce/orphan.json','{}');
  const before = fingerprint(f.repo); call(f,['init'],false); assert.deepEqual(fingerprint(f.repo),before);
  const other = fixture(t); other.write('.gitignore','.tryce/\n'); call(other,['init'],false); assert.equal(existsSync(join(other.repo,'.tryce')),false);
});

test('explicit legacy replacement can prepare and commit deletion without retaining backup files', async t => {
  const f = fixture(t); f.git(['config','user.name','Fixture']); f.git(['config','user.email','fixture@example.invalid']); f.git(['config','commit.gpgsign','false']); f.git(['config','core.autocrlf','false']);
  call(f,['init','--mode','auto']); mkdirSync(join(f.repo,'.tryce/spec/old'),{recursive:true});
  const oldPath='.tryce/spec/old/tryce.json'; f.write(oldPath,'{"kind":"tryce-requirements","format":"requirements-1","spec":"old","requirements":[],"reviews":[],"decisions":[]}\n'); f.commit('Legacy baseline');
  const config=JSON.parse(readFileSync(join(f.repo,'.tryce/config.json'),'utf8'));
  f.write('.tryce/config.json',JSON.stringify({kind:config.kind,format:'spec-1',baseline:config.baseline})+'\n');
  const {unlinkSync}=await import('node:fs'); unlinkSync(join(f.repo,oldPath));
  const saved=input(f,'save',{expected:call(f,['spec','working']).stamp,operations:[{type:'create',feature:'product',title:'제품 요구사항'},{type:'add',feature:'product',title:'사용자 의도 기록',body:'최종 요구사항을 기록한다.'}]});
  const prepared=input(f,'prepare',{expected:call(f,['spec','changes']).expected,reasons:[{requirements:[saved.results[1].id],reason:'사용자가 요청한 새 형식 전환'}]});
  const plan=input(f,'commit-plan',{verification:prepared.verification,paths:['.tryce/config.json',oldPath,'.tryce/spec/product/requirements.md','.tryce/spec/product/history.jsonl'],message:'Adopt Markdown records',authorization:{basis:'project-policy',evidence:'Fixture transition'}});
  assert.equal(input(f,'commit-apply',plan.plan).outcome,'committed');
  assert.equal(call(f,['spec','read']).specs.length,1); assert.equal(f.git(['status','--porcelain']).stdout,'');
  assert.equal(existsSync(join(f.repo,oldPath)),false);
});
