import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { compareStoreBundles } from '@gitifact/core';
import { specFixture as fixture, fingerprint } from './git-fixture.mjs';
import { readWorking, saveWorking } from '../.test-build/adapters/filesystem/store.js';
import { storeReader } from '../.test-build/adapters/git/store-reader.js';
// The 0.7 store writer, kept until the migration is verified (step 7); the `spec` commands that drove it are gone.
// Its folders are the 0.7 layout, which the current schema's documents check does not read.
const at=repo=>storeReader(repo).location();
const working=async(f,cwd=f.repo)=>readWorking(await at(cwd));
const save=async(f,operations,expected)=>saveWorking(await at(f.repo),{expected:expected??(await working(f)).stamp,operations});
const create=[{type:'create',feature:'employees',title:'사원 관리 요구사항'},{type:'add',feature:'employees',title:'본인 이미지 변경',body:'조건: 본인이 이미지를 선택합니다.\n기대 동작: 프로필 이미지를 변경합니다.'},{type:'create',feature:'profile',title:'내 프로필 요구사항'}];
for(const format of ['sha1','sha256']) test(`create, update, move and Git comparison without changing staging (${format})`,async t=>{
  const f=fixture(t,format);const empty=await working(f);assert.deepEqual(empty.specs,[]);
  const result=await save(f,create,empty.stamp);const req=result.results[1].id;
  assert.match(req,/^R-[a-z2-7]{10}$/);assert.match(result.results[0].id,/^S-[a-z2-7]{10}$/);
  assert.equal(existsSync(join(f.repo,'.gitifact/spec/employees/history.jsonl')),false);
  f.commit('initial requirements');const before=f.git(['rev-parse','HEAD']).stdout.trim();
  f.write('unrelated.txt','staged');f.git(['add','unrelated.txt']);f.write('unrelated.txt','unstaged');
  const gitBefore=fingerprint(join(f.repo,'.git'));
  const revised=await save(f,[{type:'update',id:req,title:'내 프로필 이미지 변경',body:'조건: 본인이 이미지를 선택합니다.\n기대 동작: 검증한 이미지를 저장합니다.'},{type:'move',id:req,feature:'profile'}]);
  assert.deepEqual(fingerprint(join(f.repo,'.git')),gitBefore);assert.equal(readFileSync(join(f.repo,'unrelated.txt'),'utf8'),'unstaged');
  assert.equal(revised.specs.find(s=>s.path.includes('/employees/')).requirements.length,0);
  assert.equal(revised.specs.find(s=>s.path.includes('/profile/')).requirements[0].id,req);
  const nested=await working(f,join(f.repo,'.gitifact/spec/profile'));assert.equal(nested.stamp,revised.stamp);
  f.commit('move and refine');const reader=storeReader(f.repo);
  const diff=compareStoreBundles(await reader.readBundle(before),await reader.readBundle(await reader.resolve('HEAD')));
  assert.deepEqual(diff.changes[0].types,['moved','modified']);assert.equal(diff.changes[0].id,req);
});
test('stale input, malformed bodies and duplicates preserve files',async t=>{
  const f=fixture(t);await save(f,create);const state=await working(f);const req=state.specs[0].requirements[0].id;
  const original=fingerprint(f.repo);
  for(const [operations,expected] of [[[{type:'move',id:req,feature:'profile'}],'stale'],
    [[{type:'update',id:req,title:'bad',body:'## injected'}],state.stamp],
    [[{type:'create',feature:'employees',title:'duplicate'}],state.stamp]]) {
    await assert.rejects(save(f,operations,expected),{code:'INVALID_STORE'});assert.deepEqual(fingerprint(f.repo),original);
  }
  writeFileSync(join(f.repo,'.gitifact/spec/profile/requirements.md'),readFileSync(join(f.repo,'.gitifact/spec/employees/requirements.md')));
  await assert.rejects(working(f));
});
test('second publication failure restores both files and original CRLF bytes',async t=>{
  const f=fixture(t);await save(f,create);const path=join(f.repo,'.gitifact/spec/employees/requirements.md');writeFileSync(path,readFileSync(path,'utf8').replace(/\n/g,'\r\n'));
  const state=await readWorking(await at(f.repo));const before=fingerprint(f.repo);let calls=0;
  await assert.rejects(saveWorking(await at(f.repo),{expected:state.stamp,operations:[{type:'move',id:state.specs[0].requirements[0].id,feature:'profile'}]},async(a,b)=>{if(++calls===2)throw Error('simulated IO failure');await rename(a,b);}));
  assert.equal(calls,2);assert.deepEqual(fingerprint(f.repo),before);
});
test('intervening external edit is preserved and recovery journal blocks further writes',async t=>{
  const f=fixture(t);await save(f,create);const state=await readWorking(await at(f.repo));let calls=0;
  const path=join(f.repo,'.gitifact/spec/employees/requirements.md');
  await assert.rejects(saveWorking(await at(f.repo),{expected:state.stamp,operations:[{type:'move',id:state.specs[0].requirements[0].id,feature:'profile'}]},async(a,b)=>{
    if(++calls===2){writeFileSync(path,'external editor content');throw Error('simulated failure');}await rename(a,b);
  }),/복구 자료/);
  assert.equal(readFileSync(path,'utf8'),'external editor content');assert.ok(existsSync(join(f.repo,'.git/gitifact-store.lock/recovery.json')));
  await assert.rejects(working(f));
});
test('existing formats and directory links are refused without writes',async t=>{
  const f=fixture(t);f.write('.gitifact/config.json','{}');const before=fingerprint(f.repo);
  await assert.rejects(working(f));assert.deepEqual(fingerprint(f.repo),before);
  const linked=join(f.root,'linked');mkdirSync(linked);f.git(['init','--template=',linked]);symlinkSync(join(f.repo,'.gitifact'),join(linked,'.gitifact'),'junction');
  await assert.rejects(working(f,linked));assert.deepEqual(fingerprint(f.repo),before);
});
