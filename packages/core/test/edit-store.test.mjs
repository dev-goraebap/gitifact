import test from 'node:test';
import assert from 'node:assert/strict';
import { editStore, parseSpec, renderSpec, emptyWiki } from '../dist/index.js';
const bundle=(...specs)=>({specs,wiki:emptyWiki()});
const s='S-k7m2xqab3d',r='R-v4n6paz2ce';
const source=()=>parseSpec('.gitifact/spec/posts/requirements.md',`---\nid: ${s}\n---\n# 게시물\n\n## 등록\n<!-- gitifact-req: ${r} -->\n\n저장합니다.\n`);
test('draft edits preserve IDs, reject injected structure and leave inputs untouched',()=>{
  const original=bundle(source());const before=JSON.stringify(original);
  const edited=editStore(original,[{type:'update',id:r,title:'게시물 작성',body:'제목과 본문을 저장합니다.'},{type:'rename-spec',id:s,title:'게시물 관리'}],()=>assert.fail('must not allocate'));
  assert.equal(edited.specs[0].id,s);assert.equal(edited.specs[0].requirements[0].id,r);assert.equal(JSON.stringify(original),before);
  for(const body of ['본문\n## 주입\n<!-- gitifact-req: R-b6fq2ry4ns -->\n가짜','본문\n<!-- gitifact-spec: S-u2gk5wd7ra -->','본문\n```','---\nid: S-u2gk5wd7ra\n---']) {
    assert.throws(()=>editStore(original,[{type:'update',id:r,title:'등록',body}],()=>''));
    assert.equal(JSON.stringify(original),before);
  }
});
test('allocation retries collisions and moving keeps identity and exact parsed body',()=>{
  const original=bundle(source()); let attempts=0;
  const edited=editStore(original,[{type:'create',feature:'profile',title:'프로필'},{type:'move',id:r,feature:'profile'}],()=>++attempts===1?s:'S-u2gk5wd7ra');
  assert.equal(attempts,2);assert.equal(edited.specs[0].requirements.length,0);
  assert.deepEqual(edited.specs[1].requirements[0],original.specs[0].requirements[0]);
  assert.equal(parseSpec(edited.specs[1].path,renderSpec(edited.specs[1])).id,'S-u2gk5wd7ra');
  assert.ok(renderSpec(edited.specs[1]).startsWith('---\nid: S-u2gk5wd7ra\n---\n\n# 프로필\n\n## 등록\n<!-- gitifact-req: '+r+' -->\n'));
  // A spec written by 0.4.x opens with a marker line; it reads the same and renders back as frontmatter.
  const legacy=parseSpec('.gitifact/spec/posts/requirements.md',`<!-- gitifact-spec: ${s} -->\n# 게시물\n\n## 등록\n<!-- gitifact-req: ${r} -->\n\n저장합니다.\n`);
  assert.deepEqual(legacy,source());assert.equal(renderSpec(legacy),renderSpec(source()));
  assert.throws(()=>editStore(original,[{type:'create',feature:'profile',title:'프로필'}],()=>s));
});
test('unknown fields, invalid paths, missing targets and duplicate operations fail',()=>{
  for(const op of [{type:'create',feature:'../escape',title:'bad'},{type:'create',feature:'con',title:'bad'},
    {type:'add',feature:'missing',title:'bad',body:'bad'},{type:'update',id:r,title:'x',body:'x',extra:true},
    {type:'move',id:r,feature:'posts'}]) assert.throws(()=>editStore(bundle(source()),[op],()=>s));
});
