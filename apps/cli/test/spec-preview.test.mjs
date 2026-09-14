import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const req='## 본인 이미지\n<!-- tryce-req: R-b6fq2ry4ns -->\n\n조건: 본인 이미지 변경\n기대 동작: 교체\n';
const doc=(id,body='')=>`<!-- tryce-spec: ${id} -->\n# 기능\n\n${body}`;
const a='.tryce/spec/employees/requirements.md',b='.tryce/spec/profile/requirements.md';
function run(f,args,cwd=f.repo){return spawnSync(process.execPath,[exe,'spec-preview',...args],{cwd,env:f.env,encoding:'utf8',timeout:35000});}
for(const hash of ['sha1','sha256']) test(`preview committed move, reason and unchanged worktree/index (${hash})`,t=>{
  const f=fixture(t,hash);for(const dir of ['employees','profile'])mkdirSync(join(f.repo,'.tryce/spec',dir),{recursive:true});
  f.write(a,doc('S-k7m2xqab3d',req));f.write(b,doc('S-u2gk5wd7ra'));f.commit();const before=f.git(['rev-parse','HEAD']).stdout.trim();
  f.write(a,doc('S-k7m2xqab3d'));f.write(b,doc('S-u2gk5wd7ra',req));
  f.write('.tryce/spec/profile/history.jsonl',JSON.stringify({id:'H-j3hn6vb4qt',requirements:['R-b6fq2ry4ns'],reason:'오배치 정정'})+'\n');f.commit();
  f.write(a,'uncommitted invalid data');f.git(['add',a]);f.write(a,'different unstaged data');
  const original=fingerprint(f.repo);const result=run(f,['diff','--experimental','--from',before,'--to','HEAD']);
  assert.equal(result.status,0,result.stderr);const json=JSON.parse(result.stdout);assert.equal(json.changes.length,1);assert.deepEqual(json.changes[0].types,['moved']);assert.equal(json.changes[0].reasons[0].reason,'오배치 정정');
  assert.deepEqual(fingerprint(f.repo),original);
  const nested=run(f,['read','--experimental'],join(f.repo,'.tryce/spec/profile'));assert.equal(nested.status,0,nested.stderr);assert.equal(JSON.parse(nested.stdout).specs.length,2);
  const disabled=run(f,['read']);assert.equal(disabled.status,1);assert.equal(disabled.stdout,'');
});
test('malformed source, legacy input and invalid refs never become empty success',t=>{
  const f=fixture(t);mkdirSync(join(f.repo,'.tryce/spec/employees'),{recursive:true});
  f.write(a,'# no identity');f.commit();assert.equal(run(f,['read','--experimental']).status,1);
  rmSync(join(f.repo,a));f.write('.tryce/spec/employees/tryce.json','{}');f.commit();
  const legacy=run(f,['read','--experimental']);assert.equal(legacy.status,1);assert.match(legacy.stderr,/기존 JSON/);
  const bad=run(f,['read','--experimental','--ref','--help']);assert.equal(bad.status,1);assert.equal(bad.stdout,'');
});
test('committed invalid UTF-8 and symlink tree entries fail without following targets',t=>{
  const f=fixture(t);mkdirSync(join(f.repo,'.tryce/spec/employees'),{recursive:true});
  f.write(a,Buffer.from([0xff,0xfe]));f.commit();assert.equal(run(f,['read','--experimental']).status,1);
  f.write(a,'../../outside');f.git(['add',a]);
  const blob=f.git(['rev-parse',':'+a]).stdout.trim();f.git(['update-index','--cacheinfo','120000',blob,a]);f.git(['commit','-m','link fixture']);
  const result=run(f,['read','--experimental']);assert.equal(result.status,1);assert.match(result.stderr,/링크/);
});
