import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { specFixture as fixture, fingerprint } from './git-fixture.mjs';
import { prepareWorkingPreview } from '../.test-build/adapters/filesystem/spec-preview-prepare.js';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const run=(f,args)=>spawnSync(process.execPath,[exe,'spec',...args.filter(x=>x!=='--experimental')],{cwd:f.repo,env:f.env,encoding:'utf8',timeout:35000});
const ok=result=>{assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
function input(f,action,data,extra=[]){const path=join(f.root,'input.json');writeFileSync(path,JSON.stringify(data));return run(f,[action,'--experimental','--file',path,...extra]);}
const changes=f=>ok(run(f,['changes','--experimental']));
const edit=(f,operations)=>ok(input(f,'save',{expected:ok(run(f,['working','--experimental'])).stamp,operations}));
const prepare=(f,reasons)=>ok(input(f,'prepare',{expected:changes(f).expected,reasons}));
const create=f=>edit(f,[{type:'create',feature:'posts',title:'게시물 요구사항'},{type:'add',feature:'posts',title:'등록',body:'게시물을 저장합니다.'}]);
const history=f=>readFileSync(join(f.repo,'.gitifact/spec/posts/history.jsonl'),'utf8');

for(const hash of ['sha1','sha256']) test(`final changes, idempotent reasons, staged verification and committed Git link (${hash})`,t=>{
  const f=fixture(t,hash);const initial=create(f);const id=initial.results[1].id;
  assert.equal(changes(f).base.head,null);const gitBefore=fingerprint(join(f.repo,'.git'));
  const ready=prepare(f,[{requirements:[id],reason:'게시물 저장 기능을 제공합니다.'}]);
  assert.deepEqual(fingerprint(join(f.repo,'.git')),gitBefore);assert.equal(ready.reasons.length,1);
  const line=JSON.parse(history(f));assert.deepEqual(Object.keys(line).sort(),['id','reason','requirements']);assert.match(line.id,/^H-[a-z2-7]{10}$/);
  assert.equal(changes(f).pendingReasons[0].id,line.id);
  assert.equal(input(f,'verify',ready.verification,['--staged']).status,1);
  f.git(['add','.gitifact/spec']);assert.equal(ok(input(f,'verify',ready.verification,['--staged'])).scope,'staged');
  f.commit('first spec');const before=f.git(['rev-parse','HEAD']).stdout.trim();const originalHistory=history(f);
  edit(f,[{type:'update',id,title:'등록',body:'중간 초안입니다.'}]);edit(f,[{type:'update',id,title:'등록',body:'제목이 있어야 저장합니다.'}]);
  assert.equal(changes(f).changes.length,1);assert.deepEqual(changes(f).changes[0].types,['modified']);
  f.write('unrelated.txt','staged');f.git(['add','unrelated.txt']);const index=readFileSync(join(f.repo,'.git/index'));
  const result=prepare(f,[{requirements:[id],reason:'빈 제목을 허용하지 않습니다.'}]);assert.ok(history(f).startsWith(originalHistory));
  assert.deepEqual(readFileSync(join(f.repo,'.git/index')),index);
  const same=prepare(f,[{requirements:[id],reason:'빈 제목을 허용하지 않습니다.'}]);assert.deepEqual(same.paths,[]);assert.deepEqual(same.reasons,result.reasons);
  assert.equal(input(f,'verify',ready.verification).status,1); // A previous commit's preparation is stale.
  assert.equal(input(f,'verify',result.verification,['--staged']).status,1); // The spec is not staged yet.
  f.git(['add','.gitifact/spec']);ok(input(f,'verify',result.verification,['--staged']));
  f.commit('final requirements');const diff=ok(run(f,['diff','--experimental','--from',before,'--to','HEAD']));
  assert.equal(diff.changes.length,1);assert.equal(diff.changes[0].reasons[0].reason,'빈 제목을 허용하지 않습니다.');
  assert.equal(diff.changes[0].after.body,'제목이 있어야 저장합니다.');
});
test('reverting drafts removes only uncommitted reasons, preserving committed bytes',t=>{
  const f=fixture(t);const id=create(f).results[1].id;prepare(f,[{requirements:[id],reason:'최초 기능'}]);
  const path=join(f.repo,'.gitifact/spec/posts/history.jsonl');writeFileSync(path,history(f).replace(/\n/g,'\r\n'));f.commit();const old=history(f);
  edit(f,[{type:'update',id,title:'등록',body:'중간 변경'}]);const ready=prepare(f,[{requirements:[id],reason:'임시 이유'}]);
  edit(f,[{type:'update',id,title:'등록',body:'게시물을 저장합니다.'}]);assert.equal(changes(f).changes.length,0);
  assert.equal(input(f,'verify',ready.verification).status,1);
  const reverted=prepare(f,[]);assert.equal(reverted.reasons.length,0);assert.equal(history(f),old);
  assert.equal(f.git(['diff','--','.gitifact/spec']).stdout,'');
});
test('initial draft reason disappears on revert; missing reasons are explicit, never invented',t=>{
  const f=fixture(t);const result=create(f);const id=result.results[1].id;const spec=result.specs[0];
  const unexplained=prepare(f,[]);assert.deepEqual(unexplained.withoutReason,[id]);assert.equal(existsSync(join(f.repo,'.gitifact/spec/posts/history.jsonl')),false);
  prepare(f,[{requirements:[id],reason:'최초 초안'}]);f.write(spec.path,`<!-- gitifact-spec: ${spec.id} -->\n# ${spec.title}\n`);
  assert.equal(changes(f).changes.length,0);prepare(f,[]);assert.equal(existsSync(join(f.repo,'.gitifact/spec/posts/history.jsonl')),false);
});
test('move reasons go to destination and deletion reasons remain at the source',t=>{
  const f=fixture(t);const first=create(f);const id=first.results[1].id;
  edit(f,[{type:'create',feature:'profile',title:'내 프로필'}]);prepare(f,[{requirements:[id],reason:'초기 기능'}]);f.commit();
  const old=history(f);edit(f,[{type:'move',id,feature:'profile'}]);const moved=prepare(f,[{requirements:[id],reason:'오배치 정정 시험'}]);
  assert.deepEqual(moved.changes[0].types,['moved']);assert.equal(history(f),old);
  assert.equal(JSON.parse(readFileSync(join(f.repo,'.gitifact/spec/profile/history.jsonl'),'utf8')).reason,'오배치 정정 시험');f.commit();
  const profile=moved.specs.find(s=>s.path.includes('/profile/'));f.write(profile.path,`<!-- gitifact-spec: ${profile.id} -->\n# 내 프로필\n`);
  const deleted=prepare(f,[{requirements:[id],reason:'기능 제외'}]);assert.deepEqual(deleted.changes[0].types,['deleted']);assert.equal(deleted.reasons[0].specId,profile.id);
});
test('invalid and stale reasons fail without writes; committed history cannot be rewritten',t=>{
  const f=fixture(t);const id=create(f).results[1].id;const state=changes(f);const original=fingerprint(f.repo);
  for(const data of [{expected:'stale',reasons:[]},{expected:state.expected,reasons:[{requirements:['R-aaaaaaaaaa'],reason:'unknown'}]},
    {expected:state.expected,reasons:[{requirements:[id,id],reason:'duplicate'}]}]){
    assert.equal(input(f,'prepare',data).status,1);assert.deepEqual(fingerprint(f.repo),original);
  }
  prepare(f,[{requirements:[id],reason:'original'}]);f.commit();const line=JSON.parse(history(f));line.reason='tampered';f.write('.gitifact/spec/posts/history.jsonl',JSON.stringify(line)+'\n');
  const tampered=fingerprint(f.repo);assert.equal(run(f,['changes','--experimental']).status,1);assert.deepEqual(fingerprint(f.repo),tampered);
});
test('failure publishing second history file rolls back both files',async t=>{
  const f=fixture(t);const a=create(f).results[1].id;const b=edit(f,[{type:'create',feature:'profile',title:'내 프로필'},{type:'add',feature:'profile',title:'조회',body:'조회합니다.'}]).results[1].id;
  const state=changes(f);const before=fingerprint(f.repo);let calls=0;
  await assert.rejects(prepareWorkingPreview(f.repo,{expected:state.expected,reasons:[{requirements:[a,b],reason:'초기 기능'}]},async(a,b)=>{if(++calls===2)throw Error('injected');await rename(a,b);}));
  assert.equal(calls,2);assert.deepEqual(fingerprint(f.repo),before);
  const result=prepare(f,[{requirements:[a,b],reason:'초기 기능'}]);assert.equal(result.reasons.length,2);
});
test('HEAD-only changes and merge state invalidate preparation without touching files',t=>{
  const f=fixture(t);const id=create(f).results[1].id;prepare(f,[{requirements:[id],reason:'초기'}]);f.commit();
  const state=changes(f);f.git(['commit','--allow-empty','-m','unrelated commit']);const before=fingerprint(f.repo);
  assert.equal(input(f,'prepare',{expected:state.expected,reasons:[]}).status,1);assert.deepEqual(fingerprint(f.repo),before);
  f.write('.git/MERGE_HEAD',f.git(['rev-parse','HEAD']).stdout);const merging=fingerprint(f.repo);
  assert.equal(run(f,['changes','--experimental']).status,1);assert.deepEqual(fingerprint(f.repo),merging);
});
