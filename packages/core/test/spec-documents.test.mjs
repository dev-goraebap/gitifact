import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, parseDocumentFiles, parsePreviewBundle, renderDocument, compareDocumentSets, editSpecPreview, prepareSpecPreview, emptyBundle, PRODUCT_PATH } from '../dist/index.js';
const g='G-k7m2xqab3d', p='P-v4n6paz2ce';
const guide=(body='본문입니다.')=>`<!-- gitifact-guide: ${g} -->\n\n# 레이아웃\n\n${body}\n`;

test('documents parse from their marker, render back identically and reject foreign structure',()=>{
  const doc=parseDocument('.gitifact/guides/frontend/layout.md',guide());
  assert.deepEqual(doc,{id:g,kind:'guide',path:'.gitifact/guides/frontend/layout.md',title:'레이아웃',body:'본문입니다.'});
  assert.equal(renderDocument(doc),guide());
  assert.equal(parseDocument(PRODUCT_PATH,`<!-- gitifact-product: ${p} -->\n\n# 제품\n\n소개\n`).id,p);
  for(const [path,source] of [['.gitifact/product/a.md',guide()],['.gitifact/product/overview.md',`<!-- gitifact-product: ${p} -->\n\n# 제품\n\n소개\n`],['.gitifact/guides/A.md',guide()],['.gitifact/guides/a.md',guide('```\n')],
    ['.gitifact/guides/a.md',guide('본문\n# 둘째 제목')],['.gitifact/guides/a.md',guide('<!-- gitifact-ref: R-abcdefghij -->')],['.gitifact/spec/a/requirements.md',guide()]]) assert.throws(()=>parseDocument(path,source),path+' '+source.slice(0,20));
  assert.equal(parseDocument('.gitifact/guides/a.md',guide('```\n<!-- gitifact-req: R-abcdefghij -->\n```')).body.includes('gitifact-req'),true);
});

test('bundles keep specs and documents apart, and collection history only names documents',()=>{
  const files=new Map([['.gitifact/guides/layout.md',guide()],['.gitifact/guides/history.jsonl',`{"id":"H-abcdefghij","requirements":[],"documents":["${g}"],"reason":"이유"}\n`]]);
  const bundle=parsePreviewBundle(files);
  assert.equal(bundle.specs.length,0);assert.equal(bundle.documents.find(s=>s.kind==='guide').documents[0].id,g);assert.equal(bundle.documents.find(s=>s.kind==='guide').history.length,1);
  assert.throws(()=>parseDocumentFiles(new Map([['.gitifact/guides/history.jsonl',`{"id":"H-abcdefghij","requirements":["R-abcdefghij"],"reason":"이유"}\n`]])));
  assert.throws(()=>parseDocumentFiles(new Map([['.gitifact/guides/a.md',guide()],['.gitifact/guides/b.md',guide()]])),/중복 문서 ID/);
});

test('editing allocates typed IDs, moves keep identity, and comparison reports moves and modifications',()=>{
  let n=0;const generate=prefix=>prefix+'-'+String(++n).padStart(10,'a').replace(/[^a-z2-7]/g,'a');
  const created=editSpecPreview(emptyBundle(),[{type:'set-product',title:'개요',body:'본문'},{type:'create-doc',path:'ui/layout.md',title:'레이아웃',body:'본문'}],generate);
  assert.equal(created.documents.find(s=>s.kind==='product').documents[0].path,PRODUCT_PATH);
  assert.equal(editSpecPreview({specs:[],documents:created.documents},[{type:'set-product',title:'개요 2',body:'본문'}],generate).results[0].id,created.results[0].id);
  const [productId,guideId]=created.results.map(r=>r.id);assert.match(productId,/^P-/);assert.match(guideId,/^G-/);
  const moved=editSpecPreview({specs:[],documents:created.documents},[{type:'move-doc',id:guideId,path:'layout.md'},{type:'update-doc',id:guideId,title:'레이아웃',body:'새 본문'}],generate);
  const changes=compareDocumentSets(created.documents,moved.documents);
  assert.deepEqual(changes.map(c=>[c.id,c.kind,c.types]),[[guideId,'guide',['moved','modified']]]);
  assert.throws(()=>editSpecPreview({specs:[],documents:created.documents},[{type:'move-doc',id:guideId,path:'ui/layout.md'}],generate),/같은 경로/);
  assert.throws(()=>editSpecPreview({specs:[],documents:created.documents},[{type:'update-doc',id:guideId,title:'x',body:'본문\n# 주입'}],generate));
  const prepared=prepareSpecPreview({specs:[],documents:created.documents},{specs:[],documents:moved.documents},new Map(),new Map(),[{requirements:[],documents:[guideId],reason:'정리'}],()=>'H-abcdefghij');
  assert.deepEqual([...prepared.writes.keys()],['.gitifact/guides/history.jsonl']);assert.deepEqual(prepared.withoutReason,[]);
  assert.throws(()=>prepareSpecPreview({specs:[],documents:created.documents},{specs:[],documents:moved.documents},new Map(),new Map(),[{requirements:[],documents:[productId],reason:'변경 없음'}],()=>'H-abcdefghij'),/최종 변경이 없는 문서/);
});
