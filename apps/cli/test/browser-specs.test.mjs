import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { comparePreviewBundles, emptyBundle } from '@gitifact/core';
import { fixture, fingerprint } from './git-fixture.mjs';
import { openRecords } from './browser-records.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { specPreviewReader } from '../.test-build/adapters/git/spec-preview-reader.js';
import { startBrowserServer } from '../.test-build/server/browser-server.js';

const indexFile = f => join(f.repo, '.git', 'gitifact', 'index.sqlite');
// Everything but the history index, which is a cache kept beside Git's data and not part of the project.
const project = f => { const all = fingerprint(f.repo); for (const key of Object.keys(all)) if (key.startsWith('.git/gitifact')) delete all[key]; return all; };
const doc = body => '<!-- gitifact-spec: S-abcdefghij -->\n# Posts\n\n## Save\n<!-- gitifact-req: R-abcdefghij -->\n\n' + body + '\n';

test('the browser reads the checkout and history without touching the project, and keeps its index beside Git', async t => {
  const f=fixture(t); await initializeSpecProject(f.repo,false,f.env);
  mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  const path='.gitifact/spec/posts/requirements.md';
  f.write(path,doc('First'));f.commit('Create');
  f.write(path,doc('Second'));f.commit('Modify');
  f.write(path,doc('Draft'));
  const original=project(f);const read=openRecords(f.repo,f.env);
  const result=await read();assert.equal(result.events.length,2);assert.equal(result.total,2);assert.deepEqual(result.events[0].types,['modified']);
  // The list names the change; its text on both sides is read by key.
  assert.equal('body' in result.events[0].after,false);
  const change=await read.change(result.events[0].key);assert.equal(change.before.body,'First');assert.equal(change.after.body,'Second');
  assert.equal(change.event.key,result.events[0].key);
  assert.equal(await read.change(result.head+':R-zzzzzzzzzz'),undefined);
  assert.equal(result.features[0].requirements[0].body,'Draft');assert.equal(result.working,true);assert.equal(result.contributors[0].commits,2);
  // The project is as it was; the index is the one file written, inside .git and out of `git status`.
  assert.deepEqual(project(f),original);assert.ok(existsSync(indexFile(f)));
  assert.equal(f.git(['status','--porcelain','--untracked-files=all']).stdout,' M '+path+'\n');
  f.write(path,'broken');await assert.rejects(read());
});

test('the server refuses bad queries, missing sessions and other methods on every records route', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);f.commit('init');
  const server=await startBrowserServer({cwd:f.repo,env:f.env,assetsDirectory:fileURLToPath(new URL('../../browser/dist/',import.meta.url))});t.after(()=>server.close());
  const headers={'X-Gitifact-Session':server.session.sessionId};
  const head=f.git(['rev-parse','HEAD']).stdout.trim();
  const status=async (path,init={headers})=>(await fetch(server.url+path,init)).status;
  assert.equal(await status('/api/v1/specs',{}),409);
  assert.equal(await status('/api/v1/specs?path=..'),400);
  assert.equal(await status('/api/v1/specs'),200);
  assert.equal(await status('/api/v1/specs',{headers,method:'POST'}),405);
  // History needs the HEAD it is read against; a page and the filters are checked before anything is read.
  assert.equal(await status('/api/v1/history'),400);
  assert.equal(await status('/api/v1/history?head=nope'),400);
  assert.equal(await status('/api/v1/history?head='+head+'&head='+head),400);
  assert.equal(await status('/api/v1/history?head='+head+'&limit=0'),400);
  assert.equal(await status('/api/v1/history?head='+head+'&limit=101'),400);
  assert.equal(await status('/api/v1/history?head='+head+'&kind=renamed'),400);
  assert.equal(await status('/api/v1/history?head='+head+'&unknown=1'),400);
  assert.equal(await status('/api/v1/history?head='+head+'&kind=created&offset=0&limit=10&q=x'),200);
  assert.equal(await status('/api/v1/history/summary?head='+head),200);
  assert.equal(await status('/api/v1/change?key=nope'),400);
  assert.equal(await status('/api/v1/change?key='+head+':R-zzzzzzzzzz'),404);
  assert.equal(await status('/api/v1/search'),400);
  assert.equal(await status('/api/v1/search?q=x&head='+head),200);
  assert.equal(await status('/api/v1/nothing'),404);
});

test('a page holds fifty changes and may end inside a commit, and the pages cover history exactly once',async t=>{
 const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
 const alphabet='abcdefghijklmnopqrstuvwxyz234567';
 const ids=Array.from({length:70},(_,i)=>'R-abcdefgh'+alphabet[i>>5]+alphabet[i&31]);
 // Each edit keeps the ones before it, so edit n changes exactly one record.
 const posts=(edited=0)=>'<!-- gitifact-spec: S-abcdefghij -->\n# Posts\n'+ids.map((id,i)=>`\n## ${id}\n<!-- gitifact-req: ${id} -->\n\n${i>=1&&i<=edited?'v'+i:'v0'}\n`).join('');
 // One commit creates seventy records; it is split across the first two pages.
 f.write('.gitifact/spec/posts/requirements.md',posts());f.commit('Adopt');
 f.write('unrelated.txt','code only');f.commit('Code');
 for(let i=1;i<=3;i++){f.write('.gitifact/spec/posts/requirements.md',posts(i));f.commit('Edit '+i);}
 const {history}=openRecords(f.repo,f.env);const head=f.git(['rev-parse','HEAD']).stdout.trim();
 const first=await history.page(head,{},0,50);assert.equal(first.events.length,50);assert.equal(first.total,73);
 // Three edit commits come first (newest first), then 47 of the adoption commit's 70 creations.
 assert.deepEqual(first.events.slice(0,3).map(e=>e.types),[['modified'],['modified'],['modified']]);
 const second=await history.page(head,{},50,50);assert.equal(second.events.length,23);
 const keys=[...first.events,...second.events].map(e=>e.key);assert.equal(new Set(keys).size,73);
});

test('filters and the search word apply to all of history, and the count is the whole count', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);
  const spec=(folder,sid,rid,body)=>{mkdirSync(join(f.repo,'.gitifact/spec/'+folder),{recursive:true});f.write(`.gitifact/spec/${folder}/requirements.md`,`<!-- gitifact-spec: ${sid} -->\n# ${folder}\n\n## ${folder} 요구사항\n<!-- gitifact-req: ${rid} -->\n\n${body}\n`);};
  spec('posts','S-aaaaaaaaaa','R-aaaaaaaaaa','1');f.commit('posts');
  // The fixture fixes the author through its environment, so Bob's commit names him explicitly.
  spec('tags','S-bbbbbbbbbb','R-bbbbbbbbbb','1');f.git(['add','-A']);f.git(['commit','-m','tags','--author','Bob <bob@example.invalid>']);
  for(let i=2;i<=60;i++){spec('posts','S-aaaaaaaaaa','R-aaaaaaaaaa',String(i));f.commit('posts '+i);}
  const {history}=openRecords(f.repo,f.env);const head=f.git(['rev-parse','HEAD']).stdout.trim();
  const all=await history.page(head,{},0,100);assert.equal(all.total,61);
  // Bob's one change is the 60th newest: not on a first page of fifty, and the filter still finds it.
  assert.equal((await history.page(head,{},0,50)).events.some(e=>e.email==='bob@example.invalid'),false);
  const bob=await history.page(head,{author:'bob@example.invalid'},0,50);assert.equal(bob.total,1);assert.equal(bob.events[0].id,'R-bbbbbbbbbb');
  assert.equal((await history.page(head,{feature:'S-bbbbbbbbbb'},0,50)).total,1);
  assert.equal((await history.page(head,{kind:'created'},0,50)).total,2);
  assert.equal((await history.page(head,{kind:'modified'},0,50)).total,59);
  assert.equal((await history.page(head,{document:'wiki'},0,50)).total,0);
  assert.equal((await history.page(head,{q:'tags 요구'},0,50)).total,1);
  // Each filter's pages together are exactly the matching changes of the whole list.
  const created=await history.page(head,{kind:'created'},0,1);const rest=await history.page(head,{kind:'created'},1,1);
  assert.deepEqual([...created.events,...rest.events].map(e=>e.key),all.events.filter(e=>e.types.includes('created')).map(e=>e.key));
  const summary=await history.summary(head);
  assert.equal(summary.total,61);assert.deepEqual(summary.byType,{created:2,modified:59,moved:0,deleted:0});
  assert.equal(summary.recent.length,3);assert.equal(summary.recent[0].events[0].key,all.events[0].key);
});

test('the index is kept between servers, grows with new commits, and rebuilds when damaged or of another format', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  const path='.gitifact/spec/posts/requirements.md';
  f.write(path,doc('One'));f.commit('One');f.write(path,doc('Two'));f.commit('Two');
  const head=()=>f.git(['rev-parse','HEAD']).stdout.trim();
  const keys=async ()=>(await openRecords(f.repo,f.env).history.page(head(),{},0,50)).events.map(e=>e.key);
  const first=await keys();assert.equal(first.length,2);
  const stored=()=>{const db=new DatabaseSync(indexFile(f));try{return db.prepare('SELECT count(*) AS n FROM commits').get().n;}finally{db.close();}};
  assert.equal(stored(),2);
  // A second server reads nothing again; a new commit adds only itself.
  assert.deepEqual(await keys(),first);
  f.write(path,doc('Three'));f.commit('Three');
  const grown=await keys();assert.equal(grown.length,3);assert.deepEqual(grown.slice(1),first);assert.equal(stored(),3);
  // Damaged: removed and made anew, with the same answer.
  writeFileSync(indexFile(f),'not a database');for(const extra of ['-wal','-shm'])rmSync(indexFile(f)+extra,{force:true});
  assert.deepEqual(await keys(),grown);assert.equal(stored(),3);
  // Written under another format number: dropped and rebuilt.
  {const db=new DatabaseSync(indexFile(f));db.exec('PRAGMA user_version = 999');db.close();}
  assert.deepEqual(await keys(),grown);
});

test('the search finds the checkout by title, place and text, and past changes by their reasons', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  const path='.gitifact/spec/posts/requirements.md';
  f.write(path,doc('게시물 본문에 캐시를 쓴다.'));f.commit('posts');
  f.write('.gitifact/spec/posts/history.jsonl',JSON.stringify({id:'H-aaaaaaaaaa',requirements:['R-abcdefghij'],reason:'느린 조회를 줄이려고 바꿨다.'})+'\n');
  f.write(path,doc('게시물 본문에 캐시를 둔다.'));f.commit('cache');
  const read=openRecords(f.repo,f.env);const current=await read();
  const {history}=read;const {search}=await read.checkout();const scope='checkout:'+f.repo;
  await history.syncCheckout(scope,'stamp-1',search);
  const find=q=>history.search(scope,current.head,q);
  // Two characters are below the trigram index and are still found; three and more use it.
  const short=await find('캐시');
  assert.deepEqual(short.map(h=>[h.kind,h.featureId]),[['requirement','S-abcdefghij']]);assert.match(short[0].line,/캐시를 둔다/);
  assert.ok((await find('캐시를')).some(h=>h.kind==='requirement'));
  const past=(await find('느린 조회')).filter(h=>h.kind==='history');
  assert.equal(past.length,1);assert.equal(past[0].key,current.head+':R-abcdefghij');assert.match(past[0].line,/느린 조회/);
  // A title match outranks a text match, and pattern characters are taken literally.
  assert.equal((await find('save'))[0].title,'Save');
  assert.deepEqual(await find('100%'),[]);
  // A new checkout replaces the rows; the same stamp leaves them.
  await history.syncCheckout(scope,'stamp-2',[]);assert.equal((await find('캐시')).filter(h=>h.kind!=='history').length,0);
});

test('legacy JSON files in history are not records and do not stop it', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  f.write('.gitifact/spec/posts/tryce.json','{}');f.commit('Legacy');
  f.git(['rm','-q','.gitifact/spec/posts/tryce.json']);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  f.write('.gitifact/spec/posts/requirements.md','<!-- gitifact-spec: S-abcdefghij -->\n# Posts\n\n## Save\n<!-- gitifact-req: R-abcdefghij -->\n\nBody\n');f.commit('Convert');
  const result=await openRecords(f.repo,f.env)();
  // The legacy commit changed no record, so the conversion commit is the first change.
  assert.deepEqual(result.events.map(e=>[e.message,e.types]),[['Convert',['created']]]);
});

// The index reads only the files each commit changed. Every change it reports must equal what comparing the whole
// store at the commit and its parent reports, which is how history was read before and is the oracle here.
test('reading only changed files reports the same changes, texts and reasons as comparing whole stores', async t => {
  const f=fixture(t);for(const [k,v] of [['user.name','Oracle'],['user.email','oracle@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false']])f.git(['config',k,v]);
  const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
  const cli=args=>{const r=spawnSync(process.execPath,[exe,...args],{cwd:f.repo,env:{...f.env,GITIFACT_NO_UPDATE_CHECK:'1'},encoding:'utf8',timeout:45000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const input=value=>{const p=join(f.root,'input.json');writeFileSync(p,JSON.stringify(value));return p;};
  const save=operations=>cli(['spec','save','--file',input({expected:cli(['spec','working']).stamp,operations})]);
  // Every changed record file plus the reason file of each folder it lives in; spec commit writes the reasons there.
  const commit=(message,reasons)=>{const c=cli(['spec','changes']);const changed=f.git(['status','--porcelain','-uall']).stdout.split('\n').filter(Boolean).map(l=>l.slice(3));
    const paths=[...new Set([...changed,...changed.flatMap(p=>p.startsWith('.gitifact/wiki/')?['.gitifact/wiki/history.jsonl']:p.startsWith('.gitifact/spec/')?[p.replace(/[^/]+$/,'history.jsonl')]:[])])];
    return cli(['spec','commit','--file',input({expected:c.expected,reasons,paths,message,authorization:{basis:'user-request',evidence:'oracle fixture'}})]);};
  cli(['init','--skip-agents']);f.commit('Adopt gitifact');
  const a=save([{type:'create',feature:'posts',title:'게시물'},{type:'add',feature:'posts',title:'저장',body:'제목을 저장한다.'},{type:'add',feature:'posts',title:'삭제',body:'지운다.'},
    {type:'set-design',feature:'posts',title:'게시물 설계',body:'## 개요\n\n저장소에 쓴다.'},{type:'create-doc',path:'guide.md',title:'안내',body:'처음 읽는 글.'}]);
  const [,save1,remove1]=a.results.map(r=>r.id);const posts=a.results[0].id;const guide=a.results[4].id;
  commit('Add posts',[{requirements:[save1,remove1],designs:[posts],reason:'게시물 기능을 시작한다.'},{requirements:[],documents:[guide],reason:'안내를 둔다.'}]);
  f.write('app.js','code');f.commit('Code only');
  save([{type:'update',id:save1,title:'저장',body:'제목과 본문을 저장한다.'},{type:'create',feature:'profile',title:'프로필'},{type:'move',id:remove1,feature:'profile'}]);
  commit('Move removal',[{requirements:[save1],reason:'본문도 저장한다.'},{requirements:[remove1],reason:'삭제는 프로필 기능이다.'}]);
  save([{type:'move-doc',id:guide,path:'rules/guide.md'},{type:'update-doc',id:guide,title:'안내',body:'옮긴 뒤 고친 글.'}]);
  commit('Move guide',[{requirements:[],documents:[guide],reason:'규칙 폴더로 옮긴다.'}]);
  save([{type:'delete-design',feature:'posts'}]);commit('Drop design',[{requirements:[],designs:[posts],reason:'설계를 다시 쓴다.'}]);

  const read=openRecords(f.repo,f.env);const listed=(await read()).events;
  const git=specPreviewReader(f.repo);const expected=[];
  for(const line of f.git(['log','--first-parent','--format=%H %P','HEAD']).stdout.trim().split('\n')){
    const [commit,parent]=line.split(' ');
    const changes=comparePreviewBundles(parent?await git.readBundle(parent):emptyBundle(),await git.readBundle(commit)).changes;
    expected.push(...changes.map(c=>({key:commit+':'+c.id,kind:c.kind,types:c.types,reasons:c.reasons.map(r=>r.reason),before:c.before,after:c.after})));
  }
  assert.ok(expected.length>=9,String(expected.length));
  assert.deepEqual(listed.map(e=>e.key),expected.map(e=>e.key));
  for(const [i,e] of listed.entries()){
    const want=expected[i];
    assert.deepEqual([e.kind,e.types,e.reasons],[want.kind,want.types,want.reasons],e.key);
    const change=await read.change(e.key);
    assert.deepEqual([change.before,change.after],[want.before??null,want.after??null],e.key);
  }
  // The moved requirement and the moved page read as moves, with their reasons, as the whole-store comparison says.
  assert.ok(listed.some(e=>e.id===remove1&&e.types.includes('moved')&&e.reasons.includes('삭제는 프로필 기능이다.')));
  assert.ok(listed.some(e=>e.id===guide&&e.types.includes('moved')));
});

test('authors per feature and the latest commit per page match a log per path', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});mkdirSync(join(f.repo,'.gitifact/spec/tags'),{recursive:true});
  const spec=(id,req,body)=>`<!-- gitifact-spec: ${id} -->\n# T\n\n## R\n<!-- gitifact-req: ${req} -->\n\n${body}\n`;
  const as=(name,email)=>{f.git(['config','user.name',name]);f.git(['config','user.email',email]);};
  as('Ann','ann@example.invalid');f.write('.gitifact/spec/posts/requirements.md',spec('S-aaaaaaaaaa','R-aaaaaaaaaa','1'));f.commit('posts 1');
  as('Bob','bob@example.invalid');f.write('.gitifact/spec/tags/requirements.md',spec('S-bbbbbbbbbb','R-bbbbbbbbbb','1'));f.write('.gitifact/spec/posts/requirements.md',spec('S-aaaaaaaaaa','R-aaaaaaaaaa','2'));f.commit('both');
  f.write('code.js','x');f.commit('code');
  const result=await openRecords(f.repo,f.env)();
  for(const feature of result.features){
    const folder=feature.path.replace(/\/requirements\.md$/,'');
    const lines=f.git(['log','--format=%aN%x00%aE%x00%aI','HEAD','--',folder]).stdout.trim().split('\n');
    assert.equal(feature.updatedAt,lines[0].split('\0')[2],folder);
    assert.equal(feature.contributors.reduce((n,p)=>n+p.commits,0),lines.length,folder);
  }
  for(const d of result.documents)assert.equal(d.updatedAt,f.git(['log','-1','--format=%aI','HEAD','--',d.path]).stdout.trim()||null,d.path);
});
