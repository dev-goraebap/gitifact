import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { specFixture as fixture, fingerprint } from './git-fixture.mjs';
import { readWorkingPreview, saveWorkingPreview } from '../.test-build/adapters/filesystem/spec-preview-store.js';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const run=(f,args,cwd=f.repo)=>spawnSync(process.execPath,[exe,'spec',...args.filter(x=>x!=='--experimental')],{cwd,env:f.env,encoding:'utf8',timeout:35000});
function ok(result){assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
const working=f=>ok(run(f,['working','--experimental']));
function save(f,operations,expected=working(f).stamp){
  const path=join(f.root,'input.json');writeFileSync(path,JSON.stringify({expected,operations}));
  return run(f,['save','--experimental','--file',path]);
}
const create=[{type:'create',feature:'employees',title:'사원 관리 요구사항'},{type:'add',feature:'employees',title:'본인 이미지 변경',body:'조건: 본인이 이미지를 선택합니다.\n기대 동작: 프로필 이미지를 변경합니다.'},{type:'create',feature:'profile',title:'내 프로필 요구사항'}];
for(const format of ['sha1','sha256']) test(`create, update, move and Git comparison without changing staging (${format})`,t=>{
  const f=fixture(t,format);const empty=working(f);assert.deepEqual(empty.specs,[]);
  const result=ok(save(f,create,empty.stamp));const req=result.results[1].id;
  assert.match(req,/^R-[a-z2-7]{10}$/);assert.match(result.results[0].id,/^S-[a-z2-7]{10}$/);
  assert.equal(existsSync(join(f.repo,'.tryce/spec/employees/history.jsonl')),false);
  f.commit('initial requirements');const before=f.git(['rev-parse','HEAD']).stdout.trim();
  f.write('unrelated.txt','staged');f.git(['add','unrelated.txt']);f.write('unrelated.txt','unstaged');
  const gitBefore=fingerprint(join(f.repo,'.git'));
  const revised=ok(save(f,[{type:'update',id:req,title:'내 프로필 이미지 변경',body:'조건: 본인이 이미지를 선택합니다.\n기대 동작: 검증한 이미지를 저장합니다.'},{type:'move',id:req,feature:'profile'}]));
  assert.deepEqual(fingerprint(join(f.repo,'.git')),gitBefore);assert.equal(readFileSync(join(f.repo,'unrelated.txt'),'utf8'),'unstaged');
  assert.equal(revised.specs.find(s=>s.path.includes('/employees/')).requirements.length,0);
  assert.equal(revised.specs.find(s=>s.path.includes('/profile/')).requirements[0].id,req);
  const nested=ok(run(f,['working','--experimental'],join(f.repo,'.tryce/spec/profile')));assert.equal(nested.stamp,revised.stamp);
  f.commit('move and refine');const diff=ok(run(f,['diff','--experimental','--from',before,'--to','HEAD']));
  assert.deepEqual(diff.changes[0].types,['moved','modified']);assert.equal(diff.changes[0].id,req);
});
test('stale input, malformed bodies and duplicates preserve files',t=>{
  const f=fixture(t);ok(save(f,create));const state=working(f);const req=state.specs[0].requirements[0].id;
  const original=fingerprint(f.repo);
  for(const result of [save(f,[{type:'move',id:req,feature:'profile'}],'stale'),
    save(f,[{type:'update',id:req,title:'bad',body:'## injected'}],state.stamp),
    save(f,[{type:'create',feature:'employees',title:'duplicate'}],state.stamp)]) {
    assert.equal(result.status,1);assert.equal(result.stdout,'');assert.deepEqual(fingerprint(f.repo),original);
  }
  writeFileSync(join(f.repo,'.tryce/spec/profile/requirements.md'),readFileSync(join(f.repo,'.tryce/spec/employees/requirements.md')));
  assert.equal(run(f,['working','--experimental']).status,1);
});
test('second publication failure restores both files and original CRLF bytes',async t=>{
  const f=fixture(t);ok(save(f,create));const path=join(f.repo,'.tryce/spec/employees/requirements.md');writeFileSync(path,readFileSync(path,'utf8').replace(/\n/g,'\r\n'));
  const state=await readWorkingPreview(f.repo);const before=fingerprint(f.repo);let calls=0;
  await assert.rejects(saveWorkingPreview(f.repo,{expected:state.stamp,operations:[{type:'move',id:state.specs[0].requirements[0].id,feature:'profile'}]},async(a,b)=>{if(++calls===2)throw Error('simulated IO failure');await rename(a,b);}));
  assert.equal(calls,2);assert.deepEqual(fingerprint(f.repo),before);
});
test('intervening external edit is preserved and recovery journal blocks further writes',async t=>{
  const f=fixture(t);ok(save(f,create));const state=await readWorkingPreview(f.repo);let calls=0;
  const path=join(f.repo,'.tryce/spec/employees/requirements.md');
  await assert.rejects(saveWorkingPreview(f.repo,{expected:state.stamp,operations:[{type:'move',id:state.specs[0].requirements[0].id,feature:'profile'}]},async(a,b)=>{
    if(++calls===2){writeFileSync(path,'external editor content');throw Error('simulated failure');}await rename(a,b);
  }),/복구 자료/);
  assert.equal(readFileSync(path,'utf8'),'external editor content');assert.ok(existsSync(join(f.repo,'.git/tryce-spec-preview.lock/recovery.json')));
  assert.equal(run(f,['working','--experimental']).status,1);
});
test('existing formats and directory links are refused without writes',t=>{
  const f=fixture(t);f.write('.tryce/config.json','{}');const before=fingerprint(f.repo);
  assert.equal(run(f,['working','--experimental']).status,1);assert.deepEqual(fingerprint(f.repo),before);
  const linked=join(f.root,'linked');mkdirSync(linked);f.git(['init','--template=',linked]);symlinkSync(join(f.repo,'.tryce'),join(linked,'.tryce'),'junction');
  assert.equal(run(f,['working','--experimental'],linked).status,1);assert.deepEqual(fingerprint(f.repo),before);
});
