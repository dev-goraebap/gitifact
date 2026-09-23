import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, parseWikiFiles, parseStoreBundle, compareWikis, WIKI_ENTRY_PATH, resolveLink, extractLinks, isAssetPath } from '../dist/index.js';
const w='W-k7m2xqab3d';
const page=(body='본문입니다.',id=w)=>`---\nid: ${id}\n---\n\n# 레이아웃\n\n${body}\n`;

test('wiki pages parse from frontmatter and reject foreign structure',()=>{
  const doc=parseDocument('.gitifact/wiki/frontend/layout.md',page());
  assert.deepEqual(doc,{id:w,path:'.gitifact/wiki/frontend/layout.md',title:'레이아웃',body:'본문입니다.'});
  // The entry page keeps its upper-case name so GitHub shows it when the folder is browsed.
  assert.equal(parseDocument(WIKI_ENTRY_PATH,page()).path,'.gitifact/wiki/README.md');
  assert.equal(parseDocument('.gitifact/wiki/ARCHITECTURE.md',page()).path,'.gitifact/wiki/ARCHITECTURE.md');
  // 0.4.x product and guide folders are not read at all, and a marker line in the wiki is not a page either.
  assert.throws(()=>parseDocument('.gitifact/wiki/a.md',`<!-- gitifact-guide: G-abcdefghij -->\n\n# 옛 문서\n\n본문\n`));
  for(const [path,source] of [['.gitifact/wiki/sub/README.md',page()],['.gitifact/wiki/Readme.md',page()],['.gitifact/wiki/sub/ARCHITECTURE.md',page()],['.gitifact/wiki/a.md',page('```\n')],['.gitifact/wiki/a.md',page('본문\n# 둘째 제목')],
    ['.gitifact/wiki/a.md',page('<!-- gitifact-ref: R-abcdefghij -->')],['.gitifact/spec/a/requirements.md',page()],['.gitifact/guides/a.md',page()],['.gitifact/product/PRODUCT.md',page()],
    ['.gitifact/wiki/a.md',page('본문','S-abcdefghij')],['.gitifact/wiki/a.md',page().replace('---\n\n','extra: 1\n---\n\n')],['.gitifact/wiki/a.md',page().replace('id: '+w,'id: '+w+' # note')],
    ['.gitifact/wiki/a.md','# 제목\n\n본문\n'],['.gitifact/wiki/a.md',`---\nid: ${w}\n# 제목\n\n본문\n`]]) assert.throws(()=>parseDocument(path,source),path+' '+source.slice(0,24));
  assert.equal(parseDocument('.gitifact/wiki/a.md',page('```\n<!-- gitifact-req: R-abcdefghij -->\n```')).body.includes('gitifact-req'),true);
});

test('bundles keep specs and the wiki apart, and wiki history only names pages',()=>{
  const files=new Map([['.gitifact/wiki/layout.md',page()],['.gitifact/wiki/history.jsonl',`{"id":"H-abcdefghij","requirements":[],"documents":["${w}"],"reason":"이유"}\n`]]);
  const bundle=parseStoreBundle(files);
  assert.equal(bundle.specs.length,0);assert.equal(bundle.wiki.documents[0].id,w);assert.equal(bundle.wiki.history.length,1);
  assert.throws(()=>parseWikiFiles(new Map([['.gitifact/wiki/history.jsonl',`{"id":"H-abcdefghij","requirements":["R-abcdefghij"],"reason":"이유"}\n`]])));
  assert.throws(()=>parseWikiFiles(new Map([['.gitifact/wiki/history.jsonl',`{"id":"H-abcdefghij","requirements":[],"documents":["G-abcdefghij"],"reason":"이유"}\n`]])));
  assert.throws(()=>parseWikiFiles(new Map([['.gitifact/wiki/a.md',page()],['.gitifact/wiki/b.md',page()]])),/중복 위키 페이지 ID/);
});

test('a page keeps its identity when it moves, and comparison reports the move with the change',()=>{
  const wiki=files=>parseWikiFiles(new Map(files));
  const before=wiki([['.gitifact/wiki/ui/layout.md',page()]]);
  const after=wiki([['.gitifact/wiki/layout.md',page('새 본문')]]);
  assert.deepEqual(compareWikis(before,after).map(c=>[c.id,c.kind,c.types]),[[w,'wiki',['moved','modified']]]);
  assert.deepEqual(compareWikis(before,before),[]);
});

test('links resolve against the document folder and assets are any file under the assets folder',()=>{
  assert.equal(resolveLink('.gitifact/wiki/ui/layout.md','../architecture.md'),'.gitifact/wiki/architecture.md');
  assert.equal(resolveLink('.gitifact/spec/posts/design.md','../../assets/flow.png#top'),'.gitifact/assets/flow.png');
  assert.equal(resolveLink('.gitifact/wiki/README.md','./sub/page.md?x=1'),'.gitifact/wiki/sub/page.md');
  assert.equal(resolveLink('.gitifact/wiki/README.md','../../docs/dev.md'),'docs/dev.md');
  for(const link of ['https://example.test/a','mailto:x@y','#anchor','/abs/path','../../../escape.md','a\\b.md']) assert.equal(resolveLink('.gitifact/wiki/README.md',link),null,link);
  assert.deepEqual(extractLinks('본문 [a](x.md) ![b](../img.png "제목") `[c](no.md)`\n```\n[d](fenced.md)\n```\n[e](<sp ace.md>)'),['x.md','../img.png','sp ace.md']);
  assert.equal(isAssetPath('.gitifact/assets/diagrams/flow.png'),true);
  for(const path of ['.gitifact/assets','.gitifact/assets/../x','.gitifact/wiki/a.png','assets/x.png']) assert.equal(isAssetPath(path),false,path);
});
