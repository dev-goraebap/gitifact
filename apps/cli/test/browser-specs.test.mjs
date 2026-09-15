import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, fingerprint } from './git-fixture.mjs';
import { initializeSpecProject } from '../.test-build/commands/spec-init.js';
import { createSpecBrowserReader } from '../.test-build/server/spec-reader.js';
import { startBrowserServer } from '../.test-build/server/browser-server.js';

test('browser reads real changes, current drafts and Git contributors without writes', async t => {
  const f=fixture(t); await initializeSpecProject(f.repo,false,f.env);
  mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
  const path='.gitifact/spec/posts/requirements.md';
  const doc=body=>'<!-- gitifact-spec: S-abcdefghij -->\n# Posts\n\n## Save\n<!-- gitifact-req: R-abcdefghij -->\n\n'+body+'\n';
  f.write(path,doc('First'));f.commit('Create');
  f.write(path,doc('Second'));f.commit('Modify');
  f.write(path,doc('Draft'));
  const original=fingerprint(f.repo);const read=createSpecBrowserReader(f.repo,'fixture',f.env);
  const result=await read();assert.equal(result.events.length,2);assert.deepEqual(result.events[0].types,['modified']);
  assert.equal(result.events[0].before.body,'First');assert.equal(result.events[0].after.body,'Second');
  assert.equal(result.features[0].requirements[0].body,'Draft');assert.equal(result.working,true);assert.equal(result.contributors[0].commits,2);
  assert.deepEqual(fingerprint(f.repo),original);
  f.write(path,'broken');await assert.rejects(read());
});

test('browser history pages reject stale HEAD and server enforces session and query validation', async t => {
  const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);f.commit('init');
  const read=createSpecBrowserReader(f.repo,'fixture',f.env);
  await assert.rejects(read(10,'0'.repeat(40)),/이력이 바뀌/);
  const server=await startBrowserServer({cwd:f.repo,env:f.env,assetsDirectory:fileURLToPath(new URL('../../browser/dist/',import.meta.url))});t.after(()=>server.close());
  assert.equal((await fetch(server.url+'/api/v1/specs')).status,409);
  const headers={'X-Gitifact-Session':server.session.sessionId};
  assert.equal((await fetch(server.url+'/api/v1/specs?cursor=-1',{headers})).status,400);
  assert.equal((await fetch(server.url+'/api/v1/specs?path=..',{headers})).status,400);
  assert.equal((await fetch(server.url+'/api/v1/specs',{headers})).status,200);
  assert.equal((await fetch(server.url+'/api/v1/specs',{headers,method:'POST'})).status,405);
});
test('history pagination covers every changed commit without duplicates',async t=>{
 const f=fixture(t);await initializeSpecProject(f.repo,false,f.env);mkdirSync(join(f.repo,'.gitifact/spec/posts'),{recursive:true});
 for(let i=0;i<12;i++){f.write('.gitifact/spec/posts/requirements.md',`<!-- gitifact-spec: S-abcdefghij -->\n# Posts\n## Save\n<!-- gitifact-req: R-abcdefghij -->\nVersion ${i}\n`);f.commit('Version '+i);}
 const read=createSpecBrowserReader(f.repo,'fixture',f.env),first=await read();assert.equal(first.events.length,10);assert.equal(first.nextCursor,10);
 const second=await read(first.nextCursor,first.head);assert.equal(second.events.length,2);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.events,...second.events].map(e=>e.key)).size,12);
});
