import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const cli=(f,args)=>spawnSync(process.execPath,[exe,...args],{cwd:f.repo,env:{...f.env,GITIFACT_NO_UPDATE_CHECK: '1'},encoding:'utf8',timeout:45000});
const ok=r=>{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const file=(f,value)=>{const p=join(f.root,'input.json');writeFileSync(p,JSON.stringify(value));return p;};
const commit=(f,value,...flags)=>cli(f,['spec','commit','--file',file(f,value),...flags]);
const specPaths=['.gitifact/spec/posts/requirements.md','.gitifact/spec/posts/history.jsonl'];const codePaths=['app.js','app.test.js'];
const authorization={basis:'user-request',evidence:'Fixture explicitly requests this test commit'};
const locks=f=>['gitifact-spec-commit.lock','gitifact-spec-preview.lock','index.lock'].filter(l=>existsSync(join(f.repo,'.git',l)));
function setup(t,format='sha1'){
 const f=fixture(t,format);for(const [k,v] of [['user.name','Tryce fixture'],['user.email','fixture@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false']])f.git(['config',k,v]);
 mkdirSync(join(f.repo,'.git/hooks'));ok(cli(f,['init']));f.commit('Initialize gitifact');
 const saved=ok(cli(f,['spec','save','--file',file(f,{expected:ok(cli(f,['spec','working'])).stamp,operations:[{type:'create',feature:'posts',title:'게시물'},{type:'add',feature:'posts',title:'저장',body:'제목을 입력해 저장합니다.'}]})]));
 f.write('app.js','export const save = title => !!title;\n');f.write('app.test.js','// fixture test source\n');
 return {...f,id:saved.results[1].id};
}
const request=(f,extra={})=>({reasons:[{requirements:[f.id],reason:'제목 없는 저장을 방지'}],paths:[...specPaths,...codePaths],message:'Add post saving',authorization,...extra});
for(const format of ['sha1','sha256'])test(`dry-run previews without changes, then one command records the reason and commits (${format})`,t=>{
 const f=setup(t,format);f.write('unrelated.txt','keep outside commit');const before=fingerprint(f.repo);
 const preview=ok(commit(f,request(f),'--dry-run'));
 assert.equal(preview.outcome,'dry-run');assert.equal(preview.committed,false);assert.deepEqual(preview.historyPaths,[specPaths[1]]);
 assert.deepEqual(preview.requirements,[f.id]);assert.deepEqual(preview.withoutReason,[]);assert.deepEqual(fingerprint(f.repo),before);
 const result=ok(commit(f,request(f)));
 assert.equal(result.outcome,'committed');assert.deepEqual(result.paths,[...specPaths,...codePaths].sort());assert.equal(result.commit,f.git(['rev-parse','HEAD']).stdout.trim());
 assert.equal(f.git(['status','--porcelain']).stdout,'?? unrelated.txt\n');assert.match(f.git(['log','-1','--format=%B']).stdout,new RegExp('Gitifact-Req: '+f.id));
 assert.equal(JSON.parse(f.git(['show','HEAD:'+specPaths[1]]).stdout).id,result.reasons[0].id);assert.deepEqual(locks(f),[]);
 const head=f.git(['rev-parse','HEAD']).stdout;assert.equal(commit(f,request(f)).status,1);assert.equal(f.git(['rev-parse','HEAD']).stdout,head);
});
test('missing reasons warn without blocking and code-only commits reference requirements',t=>{
 const f=setup(t);const {reasons,...rest}=request(f);
 const result=ok(commit(f,rest));assert.deepEqual(result.paths,[specPaths[0],...codePaths].sort());
 assert.deepEqual(result.withoutReason,[f.id]);assert.deepEqual(result.historyPaths,[]);assert.equal(existsSync(join(f.repo,specPaths[1])),false);
 f.write('app.js','export const save = title => !!title.trim();\n');
 const code=ok(commit(f,{paths:['app.js'],message:'Trim titles',requirements:[f.id],authorization}));
 assert.deepEqual(code.paths,['app.js']);assert.match(f.git(['log','-1','--format=%B']).stdout,new RegExp('Gitifact-Req: '+f.id));assert.equal(f.git(['status','--porcelain']).stdout,'');
});
test('omitted reasons keep uncommitted reasons, and a stale expected value is rejected without changes',t=>{
 const f=setup(t);ok(commit(f,request(f)));const written=readFileSync(join(f.repo,specPaths[1]),'utf8');
 // Undoing the commit leaves the reason in the working tree, uncommitted: exactly the state a recovered commit leaves.
 f.git(['reset','--mixed','HEAD~1']);const changes=ok(cli(f,['spec','changes']));
 assert.equal(changes.pendingReasons[0].id,JSON.parse(written).id);
 const {reasons,...rest}=request(f);const before=fingerprint(f.repo);
 assert.equal(commit(f,{...rest,expected:'stale'}).status,1);assert.deepEqual(fingerprint(f.repo),before);
 const result=ok(commit(f,{...rest,expected:changes.expected}));assert.deepEqual(result.withoutReason,[]);assert.deepEqual(result.historyPaths,[]);
 assert.equal(f.git(['show','HEAD:'+specPaths[1]]).stdout,written);assert.equal(result.reasons[0].id,JSON.parse(written).id);
});

// Ported from the removed spec prepare tests: where a reason lands when a requirement moves or goes, and that a
// committed history line cannot be rewritten afterwards.
test('a moved requirement records its reason at the destination, and a deletion at the source',t=>{
 const f=setup(t);ok(commit(f,request(f)));
 const moved=ok(cli(f,['spec','save','--file',file(f,{expected:ok(cli(f,['spec','working'])).stamp,
   operations:[{type:'create',feature:'profile',title:'프로필'},{type:'move',id:f.id,feature:'profile'}]})]));
 const destination='.gitifact/spec/profile/history.jsonl';const source=readFileSync(join(f.repo,specPaths[1]),'utf8');
 const result=ok(commit(f,{reasons:[{requirements:[f.id],reason:'요구사항을 프로필로 옮김'}],
   paths:[specPaths[0],specPaths[1],'.gitifact/spec/profile/requirements.md',destination],message:'Move the requirement',authorization}));
 assert.deepEqual(result.changes[0].types,['moved']);
 assert.equal(readFileSync(join(f.repo,specPaths[1]),'utf8'),source); // The source history keeps only what it already held.
 assert.equal(JSON.parse(readFileSync(join(f.repo,destination),'utf8').trim()).reason,'요구사항을 프로필로 옮김');
 const spec=moved.specs.find(s=>s.path.includes('/profile/'));f.write(spec.path,`---\nid: ${spec.id}\n---\n\n# 프로필\n`);
 const deleted=ok(commit(f,{reasons:[{requirements:[f.id],reason:'기능에서 제외'}],paths:['.gitifact/spec/profile/requirements.md',destination],
   message:'Drop the requirement',authorization}));
 assert.deepEqual(deleted.changes[0].types,['deleted']);assert.equal(deleted.reasons[0].specId,spec.id);
});

test('unknown and duplicated requirements are rejected, and a committed history line cannot be rewritten',t=>{
 const f=setup(t);const before=fingerprint(f.repo);
 for(const reasons of [[{requirements:['R-aaaaaaaaaa'],reason:'unknown'}],[{requirements:[f.id,f.id],reason:'duplicate'}]]){
  assert.equal(commit(f,request(f,{reasons})).status,1);assert.deepEqual(fingerprint(f.repo),before);
 }
 ok(commit(f,request(f)));const line=JSON.parse(readFileSync(join(f.repo,specPaths[1]),'utf8'));line.reason='tampered';
 f.write(specPaths[1],`${JSON.stringify(line)}\n`);const tampered=fingerprint(f.repo);
 assert.equal(cli(f,['spec','changes']).status,1);assert.deepEqual(fingerprint(f.repo),tampered);
});
test('unpaired selection, existing staging and intent-to-add are rejected without changes',t=>{
 const f=setup(t);let before=fingerprint(f.repo);
 assert.equal(commit(f,request(f,{paths:codePaths})).status,1);assert.deepEqual(fingerprint(f.repo),before);
 assert.equal(commit(f,request(f,{paths:[specPaths[0],...codePaths]})).status,1);assert.deepEqual(fingerprint(f.repo),before);
 f.git(['add','app.js']);before=fingerprint(f.repo);assert.equal(commit(f,request(f)).status,1);assert.deepEqual(fingerprint(f.repo),before);
 const g=setup(t);g.git(['add','-N','app.js']);before=fingerprint(g.repo);assert.equal(commit(g,request(g)).status,1);assert.deepEqual(fingerprint(g.repo),before);
});
test('a rejected commit restores the reason file and index, then retries cleanly',t=>{
 const f=setup(t);const hook=join(f.repo,'.git/hooks/pre-commit');writeFileSync(hook,'#!/bin/sh\nexit 1\n');
 const head=f.git(['rev-parse','HEAD']).stdout;const index=readFileSync(join(f.repo,'.git/index'));const requirements=readFileSync(join(f.repo,specPaths[0]));
 assert.equal(commit(f,request(f)).status,1);
 assert.equal(existsSync(join(f.repo,specPaths[1])),false);assert.deepEqual(readFileSync(join(f.repo,specPaths[0])),requirements);
 assert.deepEqual(readFileSync(join(f.repo,'.git/index')),index);assert.equal(f.git(['rev-parse','HEAD']).stdout,head);assert.deepEqual(locks(f),[]);
 unlinkSync(hook);ok(commit(f,request(f)));assert.equal(f.git(['rev-list','--count','HEAD']).stdout.trim(),'2');
});
test('rollback keeps a reason file edited by another process and leaves recovery data',t=>{
 const f=setup(t);writeFileSync(join(f.repo,'.git/hooks/pre-commit'),`#!/bin/sh\nprintf edited >> ${specPaths[1]}\nexit 1\n`);
 const result=commit(f,request(f));assert.equal(result.status,1);assert.match(result.stderr,/복구 자료/);
 assert.match(readFileSync(join(f.repo,specPaths[1]),'utf8'),/edited$/);assert.equal(existsSync(join(f.repo,'.git/gitifact-spec-preview.lock/recovery.json')),true);
});
test('a CRLF checkout of untouched specs commits without rewriting them (core.autocrlf)',t=>{
 const f=setup(t);const profilePaths=['.gitifact/spec/profile/requirements.md','.gitifact/spec/profile/history.jsonl'];
 const profile=ok(cli(f,['spec','save','--file',file(f,{expected:ok(cli(f,['spec','working'])).stamp,operations:[{type:'create',feature:'profile',title:'프로필'},{type:'add',feature:'profile',title:'조회',body:'프로필을 조회합니다.'}]})])).results[1].id;
 ok(commit(f,request(f,{reasons:[{requirements:[f.id,profile],reason:'초기 기능'}],paths:[...specPaths,...profilePaths,...codePaths]})));
 // Check the specs out again as Windows does: LF blobs become CRLF files while Git reports them unchanged.
 f.git(['config','core.autocrlf','true']);const all=[...specPaths,...profilePaths];
 for(const p of all)unlinkSync(join(f.repo,p));f.git(['-c','core.autocrlf=true','checkout','--',...all]);
 for(const p of all)assert.match(readFileSync(join(f.repo,p),'utf8'),/\r\n/);
 const status=()=>f.git(['-c','core.autocrlf=true','status','--porcelain']).stdout;assert.equal(status(),'');
 const crlf=profilePaths.map(p=>readFileSync(join(f.repo,p)));
 ok(cli(f,['spec','save','--file',file(f,{expected:ok(cli(f,['spec','working'])).stamp,operations:[{type:'update',id:f.id,title:'저장',body:'제목과 본문을 저장합니다.'}]})]));
 f.write('app.js','export const save = (title, body) => !!title && !!body;\n');
 const input={reasons:[{requirements:[f.id],reason:'본문도 필수로 처리'}],paths:[...specPaths,'app.js'],message:'Require body',authorization};
 assert.deepEqual(ok(commit(f,input,'--dry-run')).historyPaths,[specPaths[1]]);
 assert.deepEqual(ok(commit(f,input)).paths,[...specPaths,'app.js'].sort());
 assert.deepEqual(profilePaths.map(p=>readFileSync(join(f.repo,p))),crlf);assert.equal(status(),'');
});
test('a Git clean filter that rewrites spec content is still rejected and rolled back',t=>{
 const f=setup(t);f.git(['config','filter.upper.clean','tr a-z A-Z']);f.git(['config','filter.upper.smudge','cat']);
 f.write('.gitattributes','.gitifact/spec/** filter=upper\n');const head=f.git(['rev-parse','HEAD']).stdout;
 const result=commit(f,request(f));assert.equal(result.status,1);assert.match(result.stderr,/Git 필터/);
 assert.equal(f.git(['rev-parse','HEAD']).stdout,head);assert.equal(existsSync(join(f.repo,specPaths[1])),false);assert.deepEqual(locks(f),[]);
});
test('a hook changing the commit keeps written reasons and recovery evidence and blocks retries',t=>{
 const f=setup(t);writeFileSync(join(f.repo,'.git/hooks/pre-commit'),'#!/bin/sh\nprintf extra > extra.txt\ngit add extra.txt\n');
 const result=commit(f,request(f));assert.equal(result.status,1);assert.match(result.stderr,/복구 자료/);
 assert.equal(existsSync(join(f.repo,'.git/gitifact-spec-commit.lock/recovery.json')),true);assert.match(readFileSync(join(f.repo,specPaths[1]),'utf8'),/제목 없는 저장을 방지/);
 const head=f.git(['rev-parse','HEAD']).stdout;assert.equal(commit(f,request(f)).status,1);assert.equal(f.git(['rev-parse','HEAD']).stdout,head);
});
