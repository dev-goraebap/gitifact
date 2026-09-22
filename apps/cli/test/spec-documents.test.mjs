import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './git-fixture.mjs';
import { openRecords } from './browser-records.mjs';
import { startBrowserServer } from '../.test-build/server/browser-server.js';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const cli=(f,args)=>spawnSync(process.execPath,[exe,...args],{cwd:f.repo,env:{...f.env,GITIFACT_NO_UPDATE_CHECK: '1'},encoding:'utf8',timeout:45000});
const ok=r=>{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const file=(f,value)=>{const p=join(f.root,'input.json');writeFileSync(p,JSON.stringify(value));return p;};
const working=f=>ok(cli(f,['spec','working']));
const save=(f,operations)=>cli(f,['spec','save','--file',file(f,{expected:working(f).stamp,operations})]);
const authorization={basis:'user-request',evidence:'Fixture explicitly requests this test commit'};
// Most cases start from an empty wiki; the policy README that init writes is covered on its own below.
function setup(t,{keepPolicy=false}={}){
 const f=fixture(t);for(const [k,v] of [['user.name','Tryce fixture'],['user.email','fixture@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false']])f.git(['config',k,v]);
 ok(cli(f,['init']));
 if(!keepPolicy){unlinkSync(join(f.repo,'.gitifact/wiki/README.md'));rmdirSync(join(f.repo,'.gitifact/wiki'));}
 f.commit('Initialize gitifact');return f;
}

test('wiki pages are created, committed with reasons, moved and compared by ID',async t=>{
 const f=setup(t);
 const created=ok(save(f,[
  {type:'create-doc',path:'README.md',title:'제품 개요',body:'요구사항과 변경 이유를 Git에 연결한다. [레이아웃](frontend/layout.md)'},
  {type:'create-doc',path:'frontend/layout.md',title:'레이아웃 지침',body:'중앙 컬럼은 64rem이다.'},
 ]));
 const [entry,page]=created.results.map(r=>r.id);
 assert.match(entry,/^W-[a-z2-7]{10}$/);assert.match(page,/^W-[a-z2-7]{10}$/);
 assert.equal(readFileSync(join(f.repo,'.gitifact/wiki/README.md'),'utf8'),`---\nid: ${entry}\n---\n\n# 제품 개요\n\n요구사항과 변경 이유를 Git에 연결한다. [레이아웃](frontend/layout.md)\n`);
 assert.equal(existsSync(join(f.repo,'.gitifact/wiki/history.jsonl')),false);
 const state=working(f);assert.deepEqual(state.wiki.documents.map(d=>d.path),['.gitifact/wiki/README.md','.gitifact/wiki/frontend/layout.md']);assert.deepEqual(state.warnings,[]);
 assert.deepEqual(ok(cli(f,['spec','working','--ids'])).wiki,{documents:[{id:entry,path:'.gitifact/wiki/README.md',title:'제품 개요'},{id:page,path:'.gitifact/wiki/frontend/layout.md',title:'레이아웃 지침'}]});
 const changes=ok(cli(f,['spec','changes']));assert.deepEqual(changes.changes.map(c=>[c.id,c.kind,c.types]).sort(),[[page,'wiki',['created']],[entry,'wiki',['created']]].sort());
 const committed=ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:[page],reason:'화면 폭을 고정한다.'}],
  paths:['.gitifact/wiki/README.md','.gitifact/wiki/frontend/layout.md','.gitifact/wiki/history.jsonl'],message:'Add wiki pages',authorization})]));
 assert.equal(committed.committed,true);assert.deepEqual(committed.withoutReason,[entry]);
 const history=readFileSync(join(f.repo,'.gitifact/wiki/history.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
 assert.equal(history.length,1);assert.deepEqual(history[0].documents,[page]);assert.deepEqual(history[0].requirements,[]);
 const message=f.git(['log','-1','--format=%B']).stdout;assert.match(message,new RegExp('Gitifact-Doc: '+page));assert.match(message,new RegExp('Gitifact-Doc: '+entry));
 const read=ok(cli(f,['spec','read']));assert.equal(read.wiki.documents[0].title,'제품 개요');
 const first=f.git(['rev-parse','HEAD']).stdout.trim();
 ok(save(f,[{type:'move-doc',id:page,path:'ui/layout.md'},{type:'update-doc',id:page,title:'레이아웃 지침',body:'중앙 컬럼은 64rem이고 헤더는 얇다.'}]));
 assert.equal(existsSync(join(f.repo,'.gitifact/wiki/frontend/layout.md')),false);
 // The entry page still links to the old path; the warning names the link and blocks nothing.
 assert.deepEqual(working(f).warnings,[{code:'MISSING_LINK_TARGET',path:'.gitifact/wiki/README.md',target:'.gitifact/wiki/frontend/layout.md',link:'frontend/layout.md'}]);
 ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:[page],reason:'폴더를 ui로 정리했다.'}],
  paths:['.gitifact/wiki/frontend/layout.md','.gitifact/wiki/ui/layout.md','.gitifact/wiki/history.jsonl'],message:'Move layout page',authorization})]));
 const diff=ok(cli(f,['spec','diff','--from',first,'--to','HEAD']));
 assert.deepEqual(diff.changes.map(c=>[c.id,c.types]),[[page,['moved','modified']]]);assert.equal(diff.changes[0].reasons[0].reason,'폴더를 ui로 정리했다.');
 const api=await openRecords(f.repo, f.env)();
 assert.equal(api.version,4);assert.equal(api.documents.length,2);assert.equal(api.documents.find(d=>d.id===page).path,'.gitifact/wiki/ui/layout.md');assert.ok(api.documents.every(d=>d.updatedAt&&!('kind' in d)));
 // Changes of one commit are ordered by ID, and IDs are random: compare the first commit's two creations as a set.
 assert.deepEqual(api.events.slice(0,1).map(e=>[e.id,e.kind,e.types]),[[page,'wiki',['moved','modified']]]);
 assert.deepEqual(api.events.slice(1).map(e=>[e.id,e.kind,e.types]).sort(),[[page,'wiki',['created']],[entry,'wiki',['created']]].sort());
 assert.deepEqual(api.events[0].reasons,['폴더를 ui로 정리했다.']);
});

test('wiki commit hook failure restores history and index before a clean retry',t=>{
 const f=setup(t);
 const saved=ok(save(f,[{type:'create-doc',path:'README.md',title:'제품',body:'제품 설명'},{type:'create-doc',path:'architecture.md',title:'구조',body:'구현 지침'}]));
 const [entry,page]=saved.results.map(r=>r.id);
 const paths=['.gitifact/wiki/README.md','.gitifact/wiki/architecture.md','.gitifact/wiki/history.jsonl'];
 const input=file(f,{reasons:[{requirements:[],documents:[entry,page],reason:'제품 목적과 구현 기준을 공유한다.'}],paths,message:'Add wiki',authorization});
 const head=f.git(['rev-parse','HEAD']).stdout;
 const index=readFileSync(join(f.repo,'.git/index'));
 const originals=paths.slice(0,2).map(p=>readFileSync(join(f.repo,p)));
 const hook=join(f.repo,'.git/hooks/pre-commit');mkdirSync(join(f.repo,'.git/hooks'),{recursive:true});writeFileSync(hook,'#!/bin/sh\nexit 1\n');
 assert.equal(cli(f,['spec','commit','--file',input]).status,1);
 assert.equal(f.git(['rev-parse','HEAD']).stdout,head);
 assert.deepEqual(readFileSync(join(f.repo,'.git/index')),index);
 paths.slice(0,2).forEach((p,i)=>assert.deepEqual(readFileSync(join(f.repo,p)),originals[i]));
 assert.equal(existsSync(join(f.repo,paths[2])),false);
 unlinkSync(hook);
 const result=ok(cli(f,['spec','commit','--file',input]));
 assert.equal(result.committed,true);assert.deepEqual(result.withoutReason,[]);
 assert.equal(f.git(['status','--porcelain']).stdout,'');
});

test('invalid wiki files, foreign markers, old folders and edited committed reasons are rejected',t=>{
 const f=setup(t);
 for(const op of [{type:'create-doc',kind:'guide',path:'a.md',title:'x',body:'y'},{type:'create-doc',path:'../a.md',title:'x',body:'y'},{type:'create-doc',path:'sub/README.md',title:'x',body:'y'},
  {type:'create-doc',path:'sub/A.md',title:'x',body:'y'},{type:'create-doc',path:'a.md',title:'x',body:'본문\n<!-- gitifact-req: R-abcdefghij -->'},{type:'set-product',title:'x',body:'y'},{type:'delete-product'}]) assert.equal(save(f,[op]).status,1,JSON.stringify(op));
 mkdirSync(join(f.repo,'.gitifact/wiki'),{recursive:true});
 f.write('.gitifact/wiki/README.md','# frontmatter 없음\n\n본문\n');
 const missing=cli(f,['spec','working']);assert.equal(missing.status,1);assert.match(missing.stderr,/frontmatter/);
 f.write('.gitifact/wiki/README.md','---\nid: G-abcdefghij\n---\n\n# 옛 ID\n\n본문\n');
 assert.equal(cli(f,['spec','working']).status,1);
 f.write('.gitifact/wiki/README.md','---\nid: W-abcdefghij\n---\n\n# 제품\n\n본문\n');f.write('.gitifact/wiki/notes.txt','ignored');
 assert.equal(working(f).wiki.documents.length,1);
 // 0.4.x product and guide folders are not records any more: neither read nor accepted as a commit selection, even as a deletion.
 mkdirSync(join(f.repo,'.gitifact/product'),{recursive:true});f.write('.gitifact/product/PRODUCT.md','<!-- gitifact-product: P-abcdefghij -->\n\n# 제품\n\n본문\n');
 assert.equal(working(f).wiki.documents.length,1);
 const legacy=cli(f,['spec','commit','--file',file(f,{reasons:[],paths:['.gitifact/wiki/README.md','.gitifact/product/PRODUCT.md'],message:'x',authorization})]);
 assert.equal(legacy.status,1);assert.match(legacy.stderr,/기록·설정·에셋만 커밋할 수 있습니다/);
 unlinkSync(join(f.repo,'.gitifact/product/PRODUCT.md'));
 ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:['W-abcdefghij'],reason:'첫 문서'}],paths:['.gitifact/wiki/README.md','.gitifact/wiki/history.jsonl'],message:'Add entry page',authorization})]));
 f.write('.gitifact/wiki/history.jsonl','');
 const edited=cli(f,['spec','changes']);assert.equal(edited.status,1);assert.match(edited.stderr,/커밋된 위키 이유/);
});

test('assets are served by path under .gitifact/assets, inline for images and as downloads otherwise',async t=>{
 const f=setup(t);mkdirSync(join(f.repo,'.gitifact/assets/diagrams'),{recursive:true});
 writeFileSync(join(f.repo,'.gitifact/assets/diagrams/flow.png'),Buffer.from([0x89,0x50,0x4e,0x47]));f.write('.gitifact/assets/notes.txt','no');
 writeFileSync(join(f.repo,'.gitifact/assets/logo.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
 const server=await startBrowserServer({cwd:f.repo,env:f.env,assetsDirectory:fileURLToPath(new URL('../dist/browser/',import.meta.url))});t.after(()=>server.close());
 const get=async path=>{const r=await fetch(server.url+path);return {status:r.status,type:r.headers.get('content-type'),disposition:r.headers.get('content-disposition'),csp:r.headers.get('content-security-policy'),bytes:new Uint8Array(await r.arrayBuffer()).length};};
 assert.deepEqual(await get('/api/v1/assets/diagrams/flow.png'),{status:200,type:'image/png',disposition:'inline',csp:"default-src 'none'; sandbox",bytes:4});
 assert.equal((await get('/api/v1/assets/logo.svg')).csp,"default-src 'none'; sandbox");
 const text=await get('/api/v1/assets/notes.txt');assert.equal(text.status,200);assert.equal(text.type,'application/octet-stream');assert.equal(text.disposition,'attachment; filename="notes.txt"');
 for(const path of ['/api/v1/assets/missing.png','/api/v1/assets/','/api/v1/assets/..%2Fwiki%2FREADME.md','/api/v1/product/assets/logo.png']) assert.equal((await get(path)).status,path.includes('%2F')?400:404,path);
 assert.equal((await fetch(server.url+'/api/v1/assets/logo.svg',{method:'POST'})).status,405);
});

test('assets commit with the documents that reference them and working warns about size, extension and orphans',t=>{
 const f=setup(t);
 ok(save(f,[{type:'create-doc',path:'README.md',title:'제품',body:'![로고](../assets/logo.svg) [설계](../spec/posts/design.md)'}]));
 mkdirSync(join(f.repo,'.gitifact/assets'),{recursive:true});
 writeFileSync(join(f.repo,'.gitifact/assets/logo.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 writeFileSync(join(f.repo,'.gitifact/assets/big.bin'),Buffer.alloc(1024*1024+1));
 const before=working(f);
 assert.deepEqual(before.warnings.map(w=>[w.code,w.path??w.target]).sort(),[['ASSET_EXTENSION','.gitifact/assets/big.bin'],['ASSET_SIZE','.gitifact/assets/big.bin'],['MISSING_LINK_TARGET','.gitifact/wiki/README.md'],['UNREFERENCED_ASSET','.gitifact/assets/big.bin']].sort());
 unlinkSync(join(f.repo,'.gitifact/assets/big.bin'));
 const page=before.wiki.documents[0].id;
 const base={reasons:[{requirements:[],documents:[page],reason:'제품 개요와 로고를 등록한다.'}],message:'Add wiki entry',authorization};
 const records=['.gitifact/wiki/README.md','.gitifact/wiki/history.jsonl'];
 f.write('.gitifact/scratch.txt','not a record');
 const refused=cli(f,['spec','commit','--file',file(f,{...base,paths:[...records,'.gitifact/scratch.txt']})]);
 assert.equal(refused.status,1);assert.match(refused.stderr,/기록·설정·에셋만 커밋할 수 있습니다/);
 assert.equal(existsSync(join(f.repo,'.gitifact/wiki/history.jsonl')),false);
 ok(cli(f,['spec','commit','--file',file(f,{...base,paths:[...records,'.gitifact/assets/logo.svg']})]));
 const tracked=f.git(['ls-tree','--name-only','-r','HEAD','--','.gitifact']).stdout;
 for(const name of ['wiki/README.md','wiki/history.jsonl','assets/logo.svg']) assert.ok(tracked.includes('.gitifact/'+name),name);
 assert.ok(!tracked.includes('scratch.txt'));
});

test('init writes the wiki policy once, and docs wiki carries the edited README', t => {
 const f = setup(t, { keepPolicy: true });
 // setup ran the built init: the wiki starts with its policy page, committed like any other page.
 const [policy] = working(f).wiki.documents;
 assert.equal(policy.path, '.gitifact/wiki/README.md'); assert.equal(policy.title, '위키 운영 방침'); assert.match(policy.id, /^W-[a-z2-7]{10}$/);
 assert.match(policy.body, /^이 위키에는 아키텍처 결정 기록\(ADR\)을 쌓는다\./);
 ok(save(f, [{ type: 'update-doc', id: policy.id, title: '위키 운영 방침', body: '규칙은 rules/에 두고 결정은 adr/에 둔다.' }]));
 assert.match(cli(f, ['docs', 'wiki']).stdout, /## 운영 방침 \(\.gitifact\/wiki\/README\.md\)\n\n규칙은 rules\/에 두고 결정은 adr\/에 둔다\.\n$/);
 // A deleted README stays deleted: init does not write it again, and the bundled policy applies.
 ok(save(f, [{ type: 'delete-doc', id: policy.id }]));
 ok(cli(f, ['init']));
 assert.equal(existsSync(join(f.repo, '.gitifact/wiki/README.md')), false);
 assert.match(cli(f, ['docs', 'wiki']).stdout, /## 운영 방침 \(기본값\./);
 assert.equal('overrides' in working(f), false);
});
