import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './git-fixture.mjs';
import { createSpecBrowserReader } from '../.test-build/server/spec-reader.js';
import { startBrowserServer } from '../.test-build/server/browser-server.js';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const cli=(f,args)=>spawnSync(process.execPath,[exe,...args],{cwd:f.repo,env:f.env,encoding:'utf8',timeout:45000});
const ok=r=>{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const file=(f,value)=>{const p=join(f.root,'input.json');writeFileSync(p,JSON.stringify(value));return p;};
const working=f=>ok(cli(f,['spec','working']));
const save=(f,operations)=>cli(f,['spec','save','--file',file(f,{expected:working(f).stamp,operations})]);
const authorization={basis:'user-request',evidence:'Fixture explicitly requests this test commit'};
function setup(t){
 const f=fixture(t);for(const [k,v] of [['user.name','Tryce fixture'],['user.email','fixture@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false']])f.git(['config',k,v]);
 ok(cli(f,['init']));f.commit('Initialize gitifact');return f;
}

test('product and guide documents are created, committed with reasons, moved and compared by ID',async t=>{
 const f=setup(t);
 const created=ok(save(f,[
  {type:'set-product',title:'제품 개요',body:'요구사항과 변경 이유를 Git에 연결한다.'},
  {type:'create-doc',path:'frontend/layout.md',title:'레이아웃 지침',body:'중앙 컬럼은 64rem이다.'},
 ]));
 const [product,guide]=created.results.map(r=>r.id);
 assert.match(product,/^P-[a-z2-7]{10}$/);assert.match(guide,/^G-[a-z2-7]{10}$/);
 assert.equal(readFileSync(join(f.repo,'.gitifact/product/PRODUCT.md'),'utf8'),`<!-- gitifact-product: ${product} -->\n\n# 제품 개요\n\n요구사항과 변경 이유를 Git에 연결한다.\n`);
 assert.equal(existsSync(join(f.repo,'.gitifact/guides/history.jsonl')),false);
 const state=working(f);assert.equal(state.documents.find(s=>s.kind==='guide').documents[0].path,'.gitifact/guides/frontend/layout.md');
 const changes=ok(cli(f,['spec','changes']));assert.deepEqual(changes.changes.map(c=>[c.id,c.kind,c.types]).sort(),[[guide,'guide',['created']],[product,'product',['created']]].sort());
 const committed=ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:[guide],reason:'화면 폭을 고정한다.'}],
  paths:['.gitifact/product/PRODUCT.md','.gitifact/guides/frontend/layout.md','.gitifact/guides/history.jsonl'],message:'Add product and guide documents',authorization})]));
 assert.equal(committed.committed,true);assert.deepEqual(committed.withoutReason,[product]);
 const history=readFileSync(join(f.repo,'.gitifact/guides/history.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
 assert.equal(history.length,1);assert.deepEqual(history[0].documents,[guide]);assert.deepEqual(history[0].requirements,[]);
 const message=f.git(['log','-1','--format=%B']).stdout;assert.match(message,new RegExp('Gitifact-Doc: '+guide));assert.match(message,new RegExp('Gitifact-Doc: '+product));
 const read=ok(cli(f,['spec','read']));assert.equal(read.documents.find(s=>s.kind==='product').documents[0].title,'제품 개요');
 const first=f.git(['rev-parse','HEAD']).stdout.trim();
 ok(save(f,[{type:'move-doc',id:guide,path:'ui/layout.md'},{type:'update-doc',id:guide,title:'레이아웃 지침',body:'중앙 컬럼은 64rem이고 헤더는 얇다.'}]));
 assert.equal(existsSync(join(f.repo,'.gitifact/guides/frontend/layout.md')),false);
 ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:[guide],reason:'폴더를 ui로 정리했다.'}],
  paths:['.gitifact/guides/frontend/layout.md','.gitifact/guides/ui/layout.md','.gitifact/guides/history.jsonl'],message:'Move layout guide',authorization})]));
 const diff=ok(cli(f,['spec','diff','--from',first,'--to','HEAD']));
 assert.deepEqual(diff.changes.map(c=>[c.id,c.types]),[[guide,['moved','modified']]]);assert.equal(diff.changes[0].reasons[0].reason,'폴더를 ui로 정리했다.');
 const api=await createSpecBrowserReader(f.repo,'fixture',f.env)();
 assert.equal(api.documents.length,2);assert.equal(api.documents.find(d=>d.id===guide).path,'.gitifact/guides/ui/layout.md');assert.ok(api.documents.every(d=>d.updatedAt));
 assert.deepEqual(api.events.map(e=>[e.id,e.kind,e.types]),[[guide,'guide',['moved','modified']],[guide,'guide',['created']],[product,'product',['created']]]);
 assert.deepEqual(api.events[0].reasons,['폴더를 ui로 정리했다.']);
});

test('document commit hook failure restores both histories and index before a clean retry',t=>{
 const f=setup(t);
 const saved=ok(save(f,[{type:'set-product',title:'제품',body:'제품 설명'},{type:'create-doc',path:'architecture.md',title:'구조',body:'구현 지침'}]));
 const [product,guide]=saved.results.map(r=>r.id);
 const paths=['.gitifact/product/PRODUCT.md','.gitifact/guides/architecture.md','.gitifact/product/history.jsonl','.gitifact/guides/history.jsonl'];
 const input=file(f,{reasons:[{requirements:[],documents:[product],reason:'제품 목적을 공유한다.'},{requirements:[],documents:[guide],reason:'구현 기준을 공유한다.'}],paths,message:'Add project documents',authorization});
 const head=f.git(['rev-parse','HEAD']).stdout;
 const index=readFileSync(join(f.repo,'.git/index'));
 const originals=paths.slice(0,2).map(p=>readFileSync(join(f.repo,p)));
 const hook=join(f.repo,'.git/hooks/pre-commit');mkdirSync(join(f.repo,'.git/hooks'),{recursive:true});writeFileSync(hook,'#!/bin/sh\nexit 1\n');
 assert.equal(cli(f,['spec','commit','--file',input]).status,1);
 assert.equal(f.git(['rev-parse','HEAD']).stdout,head);
 assert.deepEqual(readFileSync(join(f.repo,'.git/index')),index);
 paths.slice(0,2).forEach((p,i)=>assert.deepEqual(readFileSync(join(f.repo,p)),originals[i]));
 paths.slice(2).forEach(p=>assert.equal(existsSync(join(f.repo,p)),false));
 unlinkSync(hook);
 const result=ok(cli(f,['spec','commit','--file',input]));
 assert.equal(result.committed,true);assert.deepEqual(result.withoutReason,[]);
 assert.equal(f.git(['status','--porcelain']).stdout,'');
});

test('invalid document files, foreign markers and edited committed reasons are rejected',t=>{
 const f=setup(t);
 for(const op of [{type:'create-doc',kind:'guide',path:'a.md',title:'x',body:'y'},{type:'create-doc',path:'../a.md',title:'x',body:'y'},
  {type:'create-doc',path:'A.md',title:'x',body:'y'},{type:'create-doc',path:'a.md',title:'x',body:'본문\n<!-- gitifact-req: R-abcdefghij -->'},{type:'delete-product'}]) assert.equal(save(f,[op]).status,1);
 mkdirSync(join(f.repo,'.gitifact/product'),{recursive:true});
 f.write('.gitifact/product/PRODUCT.md','# 마커 없음\n\n본문\n');
 const missing=cli(f,['spec','working']);assert.equal(missing.status,1);assert.match(missing.stderr,/gitifact-product/);
 f.write('.gitifact/product/PRODUCT.md','<!-- gitifact-guide: G-abcdefghij -->\n\n# 종류 불일치\n\n본문\n');
 assert.equal(cli(f,['spec','working']).status,1);
 f.write('.gitifact/product/logo.png','ignored');f.write('.gitifact/product/PRODUCT.md','<!-- gitifact-product: P-abcdefghij -->\n\n# 제품\n\n본문\n');
 assert.equal(working(f).documents.find(s=>s.kind==='product').documents.length,1);
 f.write('.gitifact/product/extra.md','<!-- gitifact-product: P-bbbbbbbbbb -->\n\n# 둘째\n\n본문\n');
 assert.match(cli(f,['spec','working']).stderr,/PRODUCT\.md 하나만/);unlinkSync(join(f.repo,'.gitifact/product/extra.md'));
 ok(cli(f,['spec','commit','--file',file(f,{reasons:[{requirements:[],documents:['P-abcdefghij'],reason:'첫 문서'}],paths:['.gitifact/product/PRODUCT.md','.gitifact/product/history.jsonl'],message:'Add product doc',authorization})]));
 f.write('.gitifact/product/history.jsonl','');
 const edited=cli(f,['spec','changes']);assert.equal(edited.status,1);assert.match(edited.stderr,/커밋된 문서 이유/);
});

test('product images beside PRODUCT.md are served by file name only',async t=>{
 const f=setup(t);mkdirSync(join(f.repo,'.gitifact/product'),{recursive:true});
 f.write('.gitifact/product/PRODUCT.md','<!-- gitifact-product: P-abcdefghij -->\n\n# 제품\n\n![로고](./logo.png)\n');
 writeFileSync(join(f.repo,'.gitifact/product/logo.png'),Buffer.from([0x89,0x50,0x4e,0x47]));f.write('.gitifact/product/notes.txt','no');
 const server=await startBrowserServer({cwd:f.repo,env:f.env,assetsDirectory:fileURLToPath(new URL('../dist/browser/',import.meta.url))});t.after(()=>server.close());
 const get=async path=>{const r=await fetch(server.url+path);return {status:r.status,type:r.headers.get('content-type'),bytes:new Uint8Array(await r.arrayBuffer()).length};};
 assert.deepEqual(await get('/api/v1/product/assets/logo.png'),{status:200,type:'image/png',bytes:4});
 for(const path of ['/api/v1/product/assets/notes.txt','/api/v1/product/assets/PRODUCT.md','/api/v1/product/assets/missing.png','/api/v1/product/assets/..%2Flogo.png']) assert.equal((await get(path)).status,path.includes('%2F')?400:404);
});

test('an image beside PRODUCT.md commits with it while other files in the folder stay rejected',async t=>{
 const f=setup(t);
 ok(save(f,[{type:'set-product',title:'제품',body:'![로고](./logo.svg)'}]));
 writeFileSync(join(f.repo,'.gitifact/product/logo.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 f.write('.gitifact/product/notes.txt','not an image');
 const product=working(f).documents.find(s=>s.kind==='product').documents[0].id;
 const base={reasons:[{requirements:[],documents:[product],reason:'제품 개요와 로고를 등록한다.'}],message:'Add product overview',authorization};
 const records=['.gitifact/product/PRODUCT.md','.gitifact/product/history.jsonl'];
 const refused=cli(f,['spec','commit','--file',file(f,{...base,paths:[...records,'.gitifact/product/notes.txt']})]);
 assert.equal(refused.status,1);assert.match(refused.stderr,/삭제만 선택할 수 있습니다/);
 assert.equal(existsSync(join(f.repo,'.gitifact/product/history.jsonl')),false);
 ok(cli(f,['spec','commit','--file',file(f,{...base,paths:[...records,'.gitifact/product/logo.svg']})]));
 const tracked=f.git(['ls-tree','--name-only','-r','HEAD','--','.gitifact/product']).stdout;
 for(const name of ['PRODUCT.md','history.jsonl','logo.svg']) assert.ok(tracked.includes('.gitifact/product/'+name),name);
 assert.ok(!tracked.includes('notes.txt'));
});
