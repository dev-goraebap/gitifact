import test from 'node:test';
import assert from 'node:assert/strict';
import { editSpecPreview, parseSpecPreview, renderSpecPreview } from '../dist/index.js';
const s='S-k7m2xqab3d',r='R-v4n6paz2ce';
const source=()=>parseSpecPreview('.gitifact/spec/posts/requirements.md',`<!-- gitifact-spec: ${s} -->\n# 게시물\n\n## 등록\n<!-- gitifact-req: ${r} -->\n\n저장합니다.\n`);
test('draft edits preserve IDs, reject injected structure and leave inputs untouched',()=>{
  const original=[source()];const before=JSON.stringify(original);
  const edited=editSpecPreview(original,[{type:'update',id:r,title:'게시물 작성',body:'제목과 본문을 저장합니다.'},{type:'rename-spec',id:s,title:'게시물 관리 요구사항'}],()=>assert.fail('must not allocate'));
  assert.equal(edited.specs[0].id,s);assert.equal(edited.specs[0].requirements[0].id,r);assert.equal(JSON.stringify(original),before);
  for(const body of ['본문\n## 주입\n<!-- gitifact-req: R-b6fq2ry4ns -->\n가짜','본문\n<!-- gitifact-spec: S-u2gk5wd7ra -->','본문\n```']) {
    assert.throws(()=>editSpecPreview(original,[{type:'update',id:r,title:'등록',body}],()=>''));
    assert.equal(JSON.stringify(original),before);
  }
});
test('allocation retries collisions and moving keeps identity and exact parsed body',()=>{
  const original=[source()]; let attempts=0;
  const edited=editSpecPreview(original,[{type:'create',feature:'profile',title:'프로필 요구사항'},{type:'move',id:r,feature:'profile'}],()=>++attempts===1?s:'S-u2gk5wd7ra');
  assert.equal(attempts,2);assert.equal(edited.specs[0].requirements.length,0);
  assert.deepEqual(edited.specs[1].requirements[0],original[0].requirements[0]);
  assert.equal(parseSpecPreview(edited.specs[1].path,renderSpecPreview(edited.specs[1])).id,'S-u2gk5wd7ra');
  assert.throws(()=>editSpecPreview(original,[{type:'create',feature:'profile',title:'프로필'}],()=>s));
});
test('unknown fields, invalid paths, missing targets and duplicate operations fail',()=>{
  for(const op of [{type:'create',feature:'../escape',title:'bad'},{type:'create',feature:'con',title:'bad'},
    {type:'add',feature:'missing',title:'bad',body:'bad'},{type:'update',id:r,title:'x',body:'x',extra:true},
    {type:'move',id:r,feature:'posts'}]) assert.throws(()=>editSpecPreview([source()],[op],()=>s));
});
