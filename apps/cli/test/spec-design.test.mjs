import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture, fingerprint} from './git-fixture.mjs';
import {createSpecBrowserReader} from '../.test-build/server/spec-reader.js';
const exe=fileURLToPath(new URL('../dist/main.js',import.meta.url));
const auth={basis:'user-request',evidence:'Isolated design test'};
function run(f,args){return spawnSync(process.execPath,[exe,...args],{cwd:f.repo,env:{...f.env,GITIFACT_NO_UPDATE_CHECK: '1'},encoding:'utf8',timeout:45000});}
function ok(r){assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
function input(f,action,value,flags=[]){const p=join(f.root,'design-input.json');writeFileSync(p,JSON.stringify(value));return run(f,['spec',action,'--file',p,...flags]);}
function save(f,operations){return ok(input(f,'save',{expected:ok(run(f,['spec','working'])).stamp,operations}));}
const req='.gitifact/spec/posts/requirements.md', design='.gitifact/spec/posts/design.md', history='.gitifact/spec/posts/history.jsonl';
function setup(t,format){const f=fixture(t,format);f.git(['config','user.name','Fixture']);f.git(['config','user.email','fixture@example.test']);f.git(['config','commit.gpgsign','false']);ok(run(f,['init']));f.commit('init');return f;}
for(const format of ['sha1','sha256'])test(`design lifecycle, reasons and real browser history (${format})`,async t=>{
 const f=setup(t,format);
 const saved=save(f,[{type:'create',feature:'posts',title:'Posts'},{type:'add',feature:'posts',title:'Save',body:'Save posts.'},{type:'set-design',feature:'posts',title:'Post design',body:'## Flow\nPersist posts.'}]);
 const sid=saved.results[0].id,rid=saved.results[1].id;
 const commit=(reasons,paths=[req,design,history])=>ok(input(f,'commit',{reasons,paths,message:'Change spec',authorization:auth}));
 const first=commit([{requirements:[rid],designs:[sid],reason:'Initial feature'}]);
 assert.deepEqual(first.requirements,[rid]);assert.equal(first.changes.length,2);
 const initial=readFileSync(join(f.repo,history),'utf8');
 save(f,[{type:'set-design',feature:'posts',title:'Post design',body:`## Flow\n<!-- gitifact-ref: ${rid} -->\nUse a cache.`}]);
 const delta=ok(run(f,['spec','changes']));assert.equal(delta.changes.length,1);assert.equal(delta.changes[0].kind,'design');
 const before=fingerprint(f.repo);const request={reasons:[{requirements:[],designs:[sid],reason:'Avoid repeated reads'}],paths:[design,history],message:'Cache design',authorization:auth};
 ok(input(f,'commit',request,['--dry-run']));assert.deepEqual(fingerprint(f.repo),before);
 const changed=ok(input(f,'commit',request));assert.deepEqual(changed.requirements,[]);assert.deepEqual(changed.withoutReason,[]);
 assert.ok(readFileSync(join(f.repo,history),'utf8').startsWith(initial));
 const read=createSpecBrowserReader(f.repo,'test',f.env);const page=await read();
 assert.equal(page.events[0].kind,'design');assert.equal(page.events[0].before.body,'## Flow\nPersist posts.');assert.match(page.events[0].after.body,/Use a cache/);
 assert.deepEqual(page.features[0].design.requirements,[rid]);assert.equal(page.events.filter(e=>e.commit===first.commit).length,2);
 const renamed='.gitifact/spec/renamed';f.git(['mv','.gitifact/spec/posts',renamed]);f.git(['reset']);
 const move=ok(run(f,['spec','changes']));assert.equal(move.changes[0].kind,'design');assert.deepEqual(move.changes[0].types,['moved']);
 f.commit('Rename folder');assert.equal((await read()).events[0].id,sid);
 save(f,[{type:'delete-design',feature:'renamed'}]);
 const deleted=ok(input(f,'commit',{paths:[renamed+'/design.md',renamed+'/history.jsonl'],message:'Remove design',authorization:auth}));
 assert.deepEqual(deleted.withoutReason,[sid]);assert.equal(deleted.changes[0].types[0],'deleted');
 assert.equal((await read()).features[0].design,undefined);assert.equal((await read()).events[0].before.id,sid);
 assert.equal(f.git(['status','--porcelain']).stdout,'');
});
test('invalid identities, missing references, stale writes and rejected commits preserve files',t=>{
 const f=setup(t,'sha1');const result=save(f,[{type:'create',feature:'posts',title:'Posts'},{type:'add',feature:'posts',title:'Save',body:'Save'}]);f.commit('Requirement only');
 const saved=save(f,[{type:'set-design',feature:'posts',title:'Design',body:'## Flow\n<!-- gitifact-ref: R-zzzzzzzzzz -->\nMissing reference'}]);assert.equal(saved.warnings[0].code,'MISSING_DESIGN_REFERENCE');
 const sid=result.results[0].id;
 const request={paths:[design,history],reasons:[{requirements:[],designs:[sid],reason:'Design'}],message:'Design',authorization:auth};
 mkdirSync(join(f.repo,'.git/hooks'),{recursive:true});f.write('.git/hooks/pre-commit','#!/bin/sh\nexit 1\n');
 const stable=()=>({files:fingerprint(join(f.repo,'.gitifact')),index:readFileSync(join(f.repo,'.git/index')),head:f.git(['rev-parse','HEAD']).stdout});
 const before=stable();assert.equal(input(f,'commit',request).status,1);assert.deepEqual(stable(),before);
 const stale=saved.stamp;save(f,[{type:'set-design',feature:'posts',title:'Design',body:'Changed'}]);
 assert.equal(input(f,'save',{expected:stale,operations:[{type:'delete-design',feature:'posts'}]}).status,1);
 const original=readFileSync(join(f.repo,design),'utf8');f.write(design,original.replace(sid,'S-zzzzzzzzzz'));assert.equal(run(f,['spec','working']).status,1);
 f.write(design,original);assert.equal(input(f,'save',{expected:ok(run(f,['spec','working'])).stamp,operations:[{type:'set-design',feature:'posts',title:'Design',body:'<!-- gitifact-ref: not-an-id -->'}]}).status,1);
});
