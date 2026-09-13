import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, symlinkSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeProject } from '../.test-build/commands/init.js';
import { modeCommand } from '../.test-build/commands/mode.js';
import { reqCommand } from '../.test-build/commands/req.js';
import { noteCommand } from '../.test-build/commands/note.js';
import { commitCommand } from '../.test-build/commands/commit.js';
import { readBrief } from '../.test-build/commands/brief.js';
import { fixture } from './git-fixture.mjs';
const setup = async (t, mode) => { const f = fixture(t); await initializeProject(f.repo, { mode }, f.env); return f; };
const req = (f, action, ids = [], o = {}, before) => reqCommand(f.repo, action, ids, o, f.env, before);
const draft = async (f, title = '검색') => (await req(f, 'draft', [], { spec: 'search', title, message: '입력한 단어로 검색한다.', author: 'Codex', reason: '사용자 요청' })).result;
const mode = (f, value) => modeCommand(f.repo, value, { reason: '사용자가 요청한 기록 정책' }, f.env);
const review = async (f, ids) => (await req(f, 'review', ids)).result;
const decide = (f, action, id) => req(f, action, [id], { by: action === 'approve' ? '사용자' : 'Codex', evidence: '대화에서 확인한 범위' });
const commit = (f, action, o, before) => commitCommand(f.repo, action, o, f.env, before);
const savePlan = (f, plan) => { const path = join(f.root, 'plan.json'); writeFileSync(path, JSON.stringify(plan)); return path; };

test('auto defaults, notes in both modes, bundled confirmation, stale revisions and historical approval', async t => {
  const f = await setup(t); assert.equal((await mode(f)).mode, 'auto');
  await noteCommand(f.repo, 'add', { type: 'discovery', message: '양쪽 모드의 발견' }, undefined, f.env);
  const a = await draft(f); const b = await draft(f, '정렬');
  assert.equal(existsSync(join(f.repo, 'specs')), false);
  assert.equal((await req(f, 'list')).items[0].path, '.tryce/spec/search/tryce.json');
  const group = await review(f, [a.id, b.id]); await decide(f, 'activate', group.id);
  let items = (await req(f, 'list')).items;
  assert.equal(items[0].id, a.id); assert(items.every(i => i.state === 'active' && i.approval === 'not-approved'));
  await mode(f, 'approval');
  await noteCommand(f.repo, 'add', { type: 'constraint', message: '승인모드에서도 note를 남긴다.' }, undefined, f.env);
  assert((await req(f, 'list')).items.every(i => i.state === 'active' && i.approval === 'not-approved'));
  const confirm = await review(f, [a.id]); await assert.rejects(decide(f, 'activate', confirm.id), { code: 'APPROVAL_REQUIRED' });
  await decide(f, 'approve', confirm.id);
  const before = JSON.parse(readFileSync(join(f.repo, '.tryce/spec/search/tryce.json'), 'utf8'));
  const revised = await req(f, 'revise', [a.id], { title: '검색 설명', message: '검색창의 입력한 단어로 검색한다.', author: 'Codex', reason: '명확한 표현', expected: a.revision, amend: true });
  await assert.rejects(decide(f, 'approve', confirm.id), { code: 'STALE_REVIEW' });
  items = (await req(f, 'list')).items;
  assert.equal(items[0].state, 'draft'); assert.equal(items[0].approval, 'not-approved'); assert.equal(items[1].approval, 'not-approved');
  const after = JSON.parse(readFileSync(join(f.repo, '.tryce/spec/search/tryce.json'), 'utf8'));
  assert.deepEqual(after.reviews, before.reviews); assert.deepEqual(after.decisions, before.decisions);
  assert.deepEqual(after.requirements[0].revisions[0], before.requirements[0].revisions[0]);
  assert.notEqual(revised.result.revision, a.revision);
  const brief = await readBrief(f.repo, {}, f.env); assert.equal(brief.version, 2); assert.equal(brief.ok, true); assert.equal(brief.report.requirements.data.total, 2);
  assert.equal(brief.report.requirements.data.items[0].path, '.tryce/spec/search/tryce.json');
});

test('0.2.0 ledgers remain readable and writable at their original paths; new specs use .tryce/spec', async t => {
  const f = await setup(t); const a = await draft(f);
  f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']); f.git(['config', 'commit.gpgsign', 'false']);
  const oldPath = 'specs/search/tryce.json'; const newPath = '.tryce/spec/search/tryce.json';
  mkdirSync(join(f.repo, 'specs/search'), { recursive: true });
  renameSync(join(f.repo, newPath), join(f.repo, oldPath)); f.commit();
  const original = JSON.parse(readFileSync(join(f.repo, oldPath)));
  assert.equal((await req(f, 'list')).items[0].path, oldPath);
  assert.equal((await readBrief(f.repo, {}, f.env)).report.requirements.data.items[0].path, oldPath);
  const group = await review(f, [a.id]); await decide(f, 'activate', group.id);
  assert.deepEqual(JSON.parse(readFileSync(join(f.repo, oldPath))).requirements, original.requirements);
  assert.equal(existsSync(join(f.repo, newPath)), false);
  const created = await req(f, 'draft', [], { spec: 'export', title: 'Export', message: 'Export records.', author: 'Fixture', reason: 'New scope' });
  assert.equal(created.path, '.tryce/spec/export/tryce.json');
  const plan = (await commit(f, 'plan', { path: [oldPath, created.path], message: 'record', policy: 'permitted', evidence: 'Fixture request' })).plan;
  assert.deepEqual(new Set(plan.requirements), new Set([a.id, created.result.id]));
  await commit(f, 'apply', { file: savePlan(f, plan) });
  assert(f.git(['log', '-1', '--format=%B']).stdout.includes('Tryce-Req: ' + a.id));
  f.write(newPath, readFileSync(join(f.repo, oldPath)));
  await assert.rejects(req(f, 'list'), { code: 'REQUIREMENT_PATH_CONFLICT' });
  unlinkSync(join(f.repo, newPath)); unlinkSync(join(f.repo, oldPath));
  await assert.rejects(req(f, 'list'), { code: 'RECORD_DELETED' });
});

test('new requirement paths respect ignore rules and detect deleted committed records', async t => {
  const f = await setup(t); f.write('.gitignore', '.tryce/spec/\n');
  await assert.rejects(draft(f));
  assert.equal(existsSync(join(f.repo, '.tryce/spec/search/tryce.json')), false);
  f.write('.gitignore', ''); await draft(f); f.commit();
  unlinkSync(join(f.repo, '.tryce/spec/search/tryce.json'));
  await assert.rejects(req(f, 'list'), { code: 'RECORD_DELETED' });
});

test('legacy migration preserves exact config, baseline and notes, and can switch repeatedly', async t => {
  const f = await setup(t, 'prototype'); await noteCommand(f.repo, 'enable', {}, undefined, f.env);
  const note = (await noteCommand(f.repo, 'add', { type: 'constraint', message: '기존 제약' }, undefined, f.env)).notes[0];
  const original = readFileSync(join(f.repo, '.tryce/config.json'));
  const migration = await mode(f, 'approval'); assert.deepEqual(readFileSync(join(f.repo, migration.backup)), original);
  assert.equal((await noteCommand(f.repo, 'list', {}, undefined, f.env)).notes[0].id, note.id);
  for (const value of ['auto', 'approval', 'auto']) await mode(f, value);
  assert.deepEqual(JSON.parse(readFileSync(join(f.repo, '.tryce/config.json'))).baseline, JSON.parse(original).baseline);
  assert.equal(readdirSync(join(f.repo, '.tryce')).filter(p => p.startsWith('mode-')).length, 4);
});

test('concurrent requirement edits and damaged snapshots fail without overwriting records', async t => {
  const f = await setup(t); const a = await draft(f); const path = join(f.repo, '.tryce/spec/search/tryce.json');
  const external = readFileSync(path, 'utf8') + '\n';
  await assert.rejects(req(f, 'review', [a.id], {}, async () => writeFileSync(path, external)), { code: 'INPUT_CHANGED' });
  assert.equal(readFileSync(path, 'utf8'), external);
  const group = await review(f, [a.id]); const ledger = JSON.parse(readFileSync(path)); ledger.reviews[0].items[0].blob = 'a'.repeat(40); writeFileSync(path, JSON.stringify(ledger));
  await assert.rejects(decide(f, 'approve', group.id), { code: 'INVALID_REQUIREMENTS' });
  const brief = await readBrief(f.repo, {}, f.env); assert.equal(brief.ok, false); assert.equal(brief.report.requirements.state, 'error');
  assert.equal(existsSync(join(f.repo, '.tryce/.notes.lock')), false);
});

test('commit scopes exact files and preserves unrelated working changes, rejects staging and stale plans', async t => {
  const f = await setup(t); f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']); f.git(['config', 'commit.gpgsign', 'false']);
  f.write('feature.txt', 'product'); f.write('unrelated.txt', 'user work');
  const options = { path: ['.tryce/config.json', 'feature.txt'], message: 'feat: product', policy: 'no-policy', evidence: '프로젝트 지침과 현재 작업에 별도 커밋 정책 없음' };
  const plan = (await commit(f, 'plan', options)).plan; const file = savePlan(f, plan);
  f.git(['add', 'unrelated.txt']); const stage = f.git(['ls-files', '--stage']).stdout;
  await assert.rejects(commit(f, 'apply', { file }), { code: 'STAGED_CHANGES_EXIST' }); assert.equal(f.git(['ls-files', '--stage']).stdout, stage);
  f.git(['rm', '--cached', 'unrelated.txt']);
  const fresh = (await commit(f, 'plan', options)).plan; savePlan(f, fresh);
  f.write('feature.txt', 'later'); await assert.rejects(commit(f, 'apply', { file }), { code: 'STALE_COMMIT_PLAN' });
  f.write('feature.txt', 'product'); savePlan(f, (await commit(f, 'plan', options)).plan);
  const done = await commit(f, 'apply', { file }); assert.equal(done.outcome, 'committed');
  assert.deepEqual(f.git(['ls-tree', '-r', '--name-only', 'HEAD']).stdout.trim().split('\n'), ['.tryce/config.json', 'feature.txt']);
  assert.equal(f.git(['diff', '--cached']).stdout, ''); assert.equal(readFileSync(join(f.repo, 'unrelated.txt'), 'utf8'), 'user work');
  assert.equal(existsSync(join(f.repo, '.git/index.lock')), false);
  assert.match(f.git(['log', '-1', '--format=%B']).stdout, /Tryce-Format: workflow-1/);
});

test('failed commit hook preserves original index, files, and recovery artifacts', async t => {
  const f = await setup(t); f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']);
  mkdirSync(join(f.repo, '.git/hooks'), { recursive: true }); writeFileSync(join(f.repo, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const plan = (await commit(f, 'plan', { path: ['.tryce/config.json'], message: 'record', policy: 'permitted', evidence: '사용자가 커밋 요청' })).plan;
  await assert.rejects(commit(f, 'apply', { file: savePlan(f, plan) }));
  assert.equal(existsSync(join(f.repo, '.git/index')), false); assert.equal(existsSync(join(f.repo, '.git/index.lock')), true);
  assert(readdirSync(join(f.repo, '.git')).some(n => n.startsWith('tryce-index-')));
  assert.equal(f.git(['rev-parse', '--verify', 'HEAD'], f.repo, true).status, 128);
});

test('built CLI exposes workflow commands and default auto init', t => {
  const f = fixture(t); const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const call = args => { const r = spawnSync(process.execPath, [entry, ...args], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 60000 }); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  assert.equal(call(['init']).mode, 'auto'); assert.equal(call(['mode', 'show']).data.mode, 'auto');
  const d = call(['req', 'draft', '--spec', 'start', '--title', '시작', '--message', '제품을 만든다.', '--author', 'Codex', '--reason', '사용자 요청']);
  assert.match(d.data.result.id, /^R-start-/); assert.equal(call(['brief']).version, 2);
});

test('committed confirmation history cannot be changed and instruction edits invalidate a commit plan', async t => {
  const f = await setup(t); const a = await draft(f); const group = await review(f, [a.id]); await decide(f, 'activate', group.id); f.commit();
  const path = join(f.repo, '.tryce/spec/search/tryce.json'); const bytes = readFileSync(path); const set = JSON.parse(bytes);
  set.decisions[0].actor = 'Someone else'; writeFileSync(path, JSON.stringify(set));
  await assert.rejects(req(f, 'list'), { code: 'RECORD_HISTORY_CHANGED' }); writeFileSync(path, bytes);
  f.write('feature.txt', 'feature'); f.write('AGENTS.md', 'Commit the current task.');
  const options = { path: ['feature.txt'], message: 'feature', policy: 'permitted', evidence: 'AGENTS.md' };
  const plan = (await commit(f, 'plan', options)).plan;
  f.write('AGENTS.md', 'Do not commit.');
  await assert.rejects(commit(f, 'apply', { file: savePlan(f, plan) }), { code: 'STALE_COMMIT_PLAN' });
  assert.equal(f.git(['diff', '--cached']).stdout, '');
  await draft(f, '미커밋 기록');
  await assert.rejects(commit(f, 'plan', options), { code: 'UNCOMMITTED_RECORD_DEPENDENCY' });
});

test('requirement storage refuses directory links and oversized ledgers before writing', async t => {
  const f = await setup(t); const outside = join(f.root, 'outside'); mkdirSync(outside);
  symlinkSync(outside, join(f.repo, '.tryce/spec'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(draft(f), { code: 'PATH_CONFLICT' }); assert.deepEqual(readdirSync(outside), []);
  const g = await setup(t); const a = await req(g, 'draft', [], { spec: 'large', title: '큰 원문', message: 'x'.repeat(16000), author: 'Fixture', reason: '한도 시험' });
  await req(g, 'review', [a.result.id]); await req(g, 'review', [a.result.id]);
  const path = join(g.repo, '.tryce/spec/large/tryce.json'); const before = readFileSync(path);
  await assert.rejects(req(g, 'review', [a.result.id]), { code: 'REQUIREMENT_LIMIT' }); assert.deepEqual(readFileSync(path), before);
});

test('commit in linked SHA-256 worktree leaves main checkout index untouched', async t => {
  const f = fixture(t, 'sha256'); f.write('base.txt', 'base'); f.commit();
  f.git(['config', 'user.name', 'Fixture']); f.git(['config', 'user.email', 'fixture@example.invalid']); f.git(['config', 'commit.gpgsign', 'false']);
  const linked = join(f.root, 'linked'); f.git(['worktree', 'add', '-b', 'linked', linked]);
  const original = readFileSync(join(f.repo, '.git/index')); const g = { ...f, repo: linked };
  await initializeProject(linked, {}, f.env); const a = await draft(g); const r = await review(g, [a.id]); assert.equal(r.items[0].blob.length, 64); await decide(g, 'activate', r.id);
  const plan = (await commit(g, 'plan', { path: ['.tryce/config.json', '.tryce/spec/search/tryce.json'], message: 'record', policy: 'permitted', evidence: 'Fixture request', req: [a.id], implement: true })).plan;
  const result = await commit(g, 'apply', { file: savePlan(g, plan) }); assert.equal(result.commit.length, 64);
  assert.deepEqual(readFileSync(join(f.repo, '.git/index')), original); assert.equal(f.git(['diff', '--cached'], linked).stdout, '');
  assert.match(f.git(['log', '-1', '--format=%B'], linked).stdout, /Tryce-Change: implement/);
  assert(f.git(['log', '-1', '--format=%B'], linked).stdout.includes('Tryce-Req: ' + a.id));
});

test('Git clean filters cannot silently rewrite requirement records in the staged snapshot', async t => {
  const f = await setup(t); f.commit(); const original = readFileSync(join(f.repo, '.git/index'));
  await draft(f); f.write('.gitattributes', '.tryce/spec/** filter=record-change\n');
  f.git(['config', 'filter.record-change.clean', 'node -e "let s=\'\';process.stdin.on(\'data\',x=>s+=x);process.stdin.on(\'end\',()=>process.stdout.write(s.replaceAll(\'Codex\',\'Changed\')))"']);
  const plan = (await commit(f, 'plan', { path: ['.tryce/spec/search/tryce.json'], message: 'record', policy: 'permitted', evidence: 'Fixture request' })).plan;
  await assert.rejects(commit(f, 'apply', { file: savePlan(f, plan) }), { code: 'STAGED_RECORD_CHANGED' });
  assert.deepEqual(readFileSync(join(f.repo, '.git/index')), original); assert.equal(existsSync(join(f.repo, '.git/index.lock')), false);
  assert.equal(JSON.parse(readFileSync(join(f.repo, '.tryce/spec/search/tryce.json'))).requirements[0].revisions[0].author, 'Codex');
});
