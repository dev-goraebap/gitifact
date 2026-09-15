import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { specFixture as fixture, fingerprint } from './git-fixture.mjs';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const run=(f,args)=>spawnSync(process.execPath,[exe,'spec',...args.filter(x=>x!=='--experimental')],{cwd:f.repo,env:f.env,encoding:'utf8',timeout:45000});
const ok=r=>{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
function input(f,action,value){const p=join(f.root,'input.json');writeFileSync(p,JSON.stringify(value));return run(f,[action,'--experimental','--file',p]);}
const allPaths=['.tryce/spec/posts/requirements.md','.tryce/spec/posts/history.jsonl','app.js','app.test.js'];
function setup(t,format='sha1'){
 const f=fixture(t,format);f.git(['config','user.name','Tryce fixture']);f.git(['config','user.email','fixture@example.invalid']);f.git(['config','commit.gpgsign','false']);f.git(['config','core.autocrlf','false']);
 mkdirSync(join(f.repo,'.git/hooks'));f.commit('Adopt tryce');
 const state=ok(run(f,['working','--experimental']));const created=ok(input(f,'save',{expected:state.stamp,operations:[{type:'create',feature:'posts',title:'게시물'},{type:'add',feature:'posts',title:'저장',body:'제목을 입력해 저장합니다.'}]}));
 f.write('app.js','export const save = title => !!title;\n');f.write('app.test.js','// fixture test source\n');
 const reason=()=>ok(input(f,'prepare',{expected:ok(run(f,['changes','--experimental'])).expected,reasons:[{requirements:[created.results[1].id],reason:'제목 없는 저장을 방지'}]}));
 const prepared=reason();return {...f,prepared,id:created.results[1].id};
}
function plan(f,selected=allPaths,verification=f.prepared.verification,requirements=[]){return input(f,'commit-plan',{verification,paths:selected,message:'Add post saving',requirements,authorization:{basis:'user-request',evidence:'Fixture explicitly requests this test commit'}});}
for(const format of ['sha1','sha256'])test(`combined spec/reason/code/test commit, clean index and stale retry (${format})`,t=>{
 const f=setup(t,format);f.write('unrelated.txt','keep outside commit');const before=fingerprint(f.repo);const p=ok(plan(f)).plan;
 assert.deepEqual(fingerprint(f.repo),before);const result=ok(input(f,'commit-apply',p));assert.equal(result.outcome,'committed');
 assert.deepEqual(result.paths,allPaths.slice().sort());assert.equal(f.git(['status','--porcelain']).stdout,'?? unrelated.txt\n');
 assert.deepEqual(f.git(['ls-tree','-r','--name-only','HEAD']).stdout.trim().split('\n'),[...allPaths,'.tryce/config.json'].sort());
 assert.match(f.git(['log','-1','--format=%B']).stdout,new RegExp('Tryce-Req: '+f.id));
 const head=f.git(['rev-parse','HEAD']).stdout;assert.equal(input(f,'commit-apply',p).status,1);assert.equal(f.git(['rev-parse','HEAD']).stdout,head);
});
test('spec-only followed by code-only commit retains requirement references',t=>{
 const f=setup(t);ok(input(f,'commit-apply',ok(plan(f,allPaths.slice(0,2))).plan));
 f.git(['update-index','--assume-unchanged',allPaths[0]]);const flag=f.git(['ls-files','-v','--',allPaths[0]]).stdout;
 const prepared=ok(input(f,'prepare',{expected:ok(run(f,['changes','--experimental'])).expected,reasons:[]}));
 const p=ok(plan(f,allPaths.slice(2),prepared.verification,[f.id])).plan;const result=ok(input(f,'commit-apply',p));
 assert.deepEqual(result.paths,['app.js','app.test.js']);assert.match(f.git(['log','-1','--format=%B']).stdout,new RegExp(f.id));
 assert.equal(f.git(['status','--porcelain']).stdout,'');
 assert.equal(f.git(['ls-files','-v','--',allPaths[0]]).stdout,flag);
});
test('missing paired files, staging and intent-to-add are rejected without changes',t=>{
 const f=setup(t);let before=fingerprint(f.repo);assert.equal(plan(f,['app.js']).status,1);assert.deepEqual(fingerprint(f.repo),before);
 f.git(['add','app.js']);before=fingerprint(f.repo);assert.equal(plan(f).status,1);assert.deepEqual(fingerprint(f.repo),before);
 const g=setup(t);g.git(['add','-N','app.js']);before=fingerprint(g.repo);assert.equal(plan(g).status,1);assert.deepEqual(fingerprint(g.repo),before);
});
test('code, policy and requirement edits invalidate the plan',t=>{
 const f=setup(t);const p=ok(plan(f)).plan;f.write('app.js','changed');let before=fingerprint(f.repo);
 assert.equal(input(f,'commit-apply',p).status,1);assert.deepEqual(fingerprint(f.repo),before);
 const updated=ok(plan(f)).plan;f.write('AGENTS.md','Changed commit policy');before=fingerprint(f.repo);
 assert.equal(input(f,'commit-apply',updated).status,1);assert.deepEqual(fingerprint(f.repo),before);
 const latest=ok(plan(f)).plan;const reqPath=join(f.repo,allPaths[0]);writeFileSync(reqPath,readFileSync(reqPath,'utf8').replace('제목을 입력해 저장합니다.','제목과 본문을 저장합니다.'));before=fingerprint(f.repo);
 assert.equal(input(f,'commit-apply',latest).status,1);assert.deepEqual(fingerprint(f.repo),before);
});
test('failed pre-commit hook preserves index and allows retry without duplicate commits',t=>{
 const f=setup(t);const hook=join(f.repo,'.git/hooks/pre-commit');writeFileSync(hook,'#!/bin/sh\nexit 1\n');const p=ok(plan(f)).plan;
 const original=existsSync(join(f.repo,'.git/index'))?readFileSync(join(f.repo,'.git/index')):null;
 assert.equal(input(f,'commit-apply',p).status,1);assert.equal(existsSync(join(f.repo,'.git/tryce-spec-commit.lock')),false);assert.equal(existsSync(join(f.repo,'.git/index.lock')),false);
 assert.deepEqual(existsSync(join(f.repo,'.git/index'))?readFileSync(join(f.repo,'.git/index')):null,original);
 unlinkSync(hook);ok(input(f,'commit-apply',p));assert.equal(f.git(['rev-list','--count','HEAD']).stdout.trim(),'2');
});
test('hook changing the commit leaves recovery evidence and blocks blind retries',t=>{
 const f=setup(t);writeFileSync(join(f.repo,'.git/hooks/pre-commit'),'#!/bin/sh\nprintf extra > extra.txt\ngit add extra.txt\n');const p=ok(plan(f)).plan;
 const result=input(f,'commit-apply',p);assert.equal(result.status,1);assert.match(result.stderr,/복구 자료/);
 assert.equal(existsSync(join(f.repo,'.git/tryce-spec-commit.lock/recovery.json')),true);const head=f.git(['rev-parse','HEAD']).stdout;
 assert.equal(input(f,'commit-apply',p).status,1);assert.equal(f.git(['rev-parse','HEAD']).stdout,head);assert.ok(existsSync(join(f.repo,'extra.txt')));
});
