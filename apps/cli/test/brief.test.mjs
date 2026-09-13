import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readBrief, briefText } from '../.test-build/commands/brief.js';
import { initializeProject } from '../.test-build/commands/init.js';
import { noteCommand } from '../.test-build/commands/note.js';
import { briefV1 } from '@tryce/contracts';
import { fixture, fingerprint } from './git-fixture.mjs';
const brief = (f, options = {}, hook, cwd = f.repo) => readBrief(cwd, options, f.env, hook);
const setup = async t => {
  const f = fixture(t); await initializeProject(f.repo, {mode:'prototype'}, f.env);
  await noteCommand(f.repo, 'enable', {}, undefined, f.env); return f;
};
const record = index => ({kind:'tryce-note',format:'note-1', id:`N-${String(index).padStart(8,'0')}-1234-4234-8234-123456789abc`,
  type:'discovery', recordedAt:new Date(Date.UTC(2026,8,13,0,0,index)).toISOString(), text:'🐳'.repeat(241), author:null, references:[], supersedes:null});

test('uninitialized and init-only projects are distinct from read failures and checks remain unrun', async t => {
  const f = fixture(t); const before = fingerprint(f.repo);
  const bare = briefV1.parse(await brief(f)); assert.equal(bare.ok, true);
  assert.equal(bare.report.project.reason, 'not-initialized'); assert.equal(bare.report.checks.state, 'not-run');
  assert.deepEqual(fingerprint(f.repo), before);
  await initializeProject(f.repo, {mode:'prototype'}, f.env);
  const initialized = await brief(f); assert.equal(initialized.ok, true);
  assert.equal(initialized.report.project.data.mode, 'prototype'); assert.equal(initialized.report.notes.reason, 'notes-not-enabled');
});

test('summary and --all expose source, omission counts, Unicode text and document locations without writes', async t => {
  const f = await setup(t); mkdirSync(join(f.repo,'.tryce/notes'));
  for (let i = 0; i < 25; i++) { const n=record(i); writeFileSync(join(f.repo,'.tryce/notes',n.id+'.json'),JSON.stringify(n)); f.write('change-'+i, 'x'); }
  f.write('AGENTS.md','instructions'); f.write('README.md','readme'); mkdirSync(join(f.repo,'docs'));
  for(let i=0;i<35;i++) f.write('docs/doc-'+String(i).padStart(2,'0')+'.md','document');
  const before=fingerprint(f.repo);
  const value=await brief(f); assert.equal(value.ok,true,JSON.stringify(value));
  const r=value.report;
  assert.equal(r.notes.data.total,25); assert.equal(r.notes.data.omitted,5); assert.equal(r.notes.data.items[0].textTruncated,true);
  assert.equal(r.documents.data.total,37); assert.equal(r.documents.data.omitted,7); assert.ok(r.git.changes.omitted>0);
  assert.equal(r.scope.notes,'working-tree'); assert.ok(r.unsupported.includes('open-questions'));
  const all=await brief(f,{all:true}); assert.equal(all.ok,true);
  assert.equal(all.report.notes.data.omitted,0); assert.equal(all.report.notes.data.items[0].text,'🐳'.repeat(241));
  assert.equal(all.report.documents.data.omitted,0); assert.equal(all.report.git.changes.omitted,0);
  assert.match(briefText(value),/본문 생략 있음/); assert.match(briefText(value),/미결 질문/);
  assert.deepEqual(fingerprint(f.repo),before);
});

test('corrupt or locked notes yield a partial report with Git data instead of a false empty list', async t => {
  const f=await setup(t); mkdirSync(join(f.repo,'.tryce/notes')); const n=record(0);
  writeFileSync(join(f.repo,'.tryce/notes',n.id+'.json'),'{');
  const value=await brief(f); assert.equal(value.ok,false); assert.equal(value.error.code,'INCOMPLETE_BRIEF');
  assert.equal(value.report.notes.error.code,'INVALID_NOTE'); assert.equal(value.report.git.head.state,'unborn');
  writeFileSync(join(f.repo,'.tryce/notes',n.id+'.json'),JSON.stringify(n)); f.write('.tryce/.notes.lock','pending');
  const locked=await brief(f); assert.equal(locked.report.notes.error.code,'PROJECT_BUSY');
  assert.equal(readFileSync(join(f.repo,'.tryce/.notes.lock'),'utf8'),'pending');
});

test('unknown or deleted config is never replaced by defaults or the HEAD version', async t => {
  const f=fixture(t); await initializeProject(f.repo,{mode:'prototype'},f.env); f.commit('config');
  f.write('.tryce/config.json','{"kind":"tryce-project","format":"future"}');
  const invalid=await brief(f); assert.equal(invalid.ok,false); assert.equal(invalid.report.project.error.code,'UNSUPPORTED_FORMAT');
  unlinkSync(join(f.repo,'.tryce/config.json'));
  const deleted=await brief(f); assert.equal(deleted.ok,false); assert.equal(deleted.report.project.error.code,'CONFIG_DELETED');
});

test('Git races invalidate the report while config and note races invalidate their components', async t => {
  const f=await setup(t); f.write('tracked','original'); f.commit('setup');
  const changed=await brief(f,{},async()=>{ f.write('new-file','new'); });
  assert.equal(changed.ok,false); assert.equal(changed.error.code,'REPOSITORY_CHANGED'); assert.equal(changed.report,null);
  f.write('.tryce/config.json',readFileSync(join(f.repo,'.tryce/config.json'),'utf8')+'\n');
  const config=await brief(f,{},async()=>{ f.write('.tryce/config.json',readFileSync(join(f.repo,'.tryce/config.json'),'utf8')+'\n'); });
  assert.equal(config.ok,false); assert.equal(config.report.project.error.code,'INPUT_CHANGED');
  mkdirSync(join(f.repo,'.tryce/notes')); const n=record(0); const notePath=join(f.repo,'.tryce/notes',n.id+'.json');
  writeFileSync(notePath,JSON.stringify(n));
  const noteRace=await brief(f,{},async()=>{ writeFileSync(notePath,JSON.stringify({...n,text:'changed'})); });
  assert.equal(noteRace.ok,false); assert.equal(noteRace.report.notes.error.code,'INPUT_CHANGED');
  assert.equal(noteRace.report.project.state,'available');
});

test('linked documentation is not followed and a linked worktree gets its own context', async t => {
  const f=fixture(t); f.write('a','a'); f.commit(); const other=join(f.root,'other'); f.git(['worktree','add','-b','other',other]);
  const outside=join(f.root,'outside'); mkdirSync(outside); writeFileSync(join(outside,'secret.md'),'private');
  symlinkSync(outside,join(other,'docs'),'junction'); const before=fingerprint(f.repo);
  const result=await brief(f,{},undefined,other); assert.equal(result.ok,false);
  assert.equal(result.report.git.head.branch,'other'); assert.equal(result.report.documents.error.code,'DOCUMENT_PATH_CONFLICT');
  assert.deepEqual(fingerprint(f.repo),before);
});

test('built CLI preserves JSON channels, partial reports and option validation', async t => {
  const f=fixture(t); const entry=fileURLToPath(new URL('../dist/main.js',import.meta.url));
  const cli=args=>spawnSync(process.execPath,[entry,'brief',...args],{cwd:f.repo,env:f.env,encoding:'utf8',timeout:35000});
  const normal=cli([]); assert.equal(normal.status,0,normal.stderr); assert.equal(briefV1.parse(JSON.parse(normal.stdout)).ok,true);
  const bad=cli(['--wrong']); assert.equal(bad.status,1); assert.equal(bad.stdout,'');
  mkdirSync(join(f.repo,'.tryce')); f.write('.tryce/config.json','{');
  const partial=cli([]); assert.equal(partial.status,1); assert.equal(partial.stdout,'');
  assert.equal(briefV1.parse(JSON.parse(partial.stderr)).error.code,'INCOMPLETE_BRIEF');
});
