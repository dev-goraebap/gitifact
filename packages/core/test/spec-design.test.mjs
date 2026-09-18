import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDesignPreview,parseSpecPreview,parsePreviewFiles,compareSpecPreviews,editSpecPreview,renderDesignPreview,documentLinks} from '../dist/index.js';
const sid='S-abcdefghij',rid='R-abcdefghij',path='.gitifact/spec/posts/requirements.md';
const req=`---\nid: ${sid}\n---\n# Posts\n## Save\n<!-- gitifact-req: ${rid} -->\nSave`;
const doc=body=>`---\nid: ${sid}\n---\n# Design\n${body}`;
const legacy=body=>`<!-- gitifact-design: ${sid} -->\n# Design\n${body}`;
test('design reference grammar ignores fenced examples and validates owner, title and body',()=>{
 const design=parseDesignPreview(doc(`## Flow\n<!-- gitifact-ref: ${rid} -->\n\n\`\`\`md\n<!-- gitifact-ref: invalid -->\n\`\`\``).replace(/\n/g,'\r\n'),sid);
 assert.deepEqual(design.requirements,[rid]);assert.deepEqual(design.sources,[]);
 // Designs written by 0.4.x open with a marker line and still read from history.
 assert.equal(parseDesignPreview(legacy('Body'),sid).body,'Body');
 for(const input of [doc(''),doc('<!-- gitifact-ref: invalid -->'),doc('# Second title'),doc('```\nopen'),doc('Body').replace(sid,'S-zzzzzzzzzz'),legacy('Body').replace(sid,'S-zzzzzzzzzz')])assert.throws(()=>parseDesignPreview(input,sid));
 assert.throws(()=>parsePreviewFiles(new Map([[path.replace('requirements','design'),doc('Orphan')]])));
});
test('sources live in the frontmatter, round-trip with quoting, and count as a design change',()=>{
 const sources=[{title:'아키텍처',path:'../../wiki/architecture.md',note:'계층: 의존 방향'},{title:'Astryx Markdown',url:'https://example.test/docs?x=1#y'}];
 const text=renderDesignPreview(sid,{title:'Design',body:'Body',sources});
 assert.equal(text,`---\nid: ${sid}\nsources:\n  - title: 아키텍처\n    path: ../../wiki/architecture.md\n    note: "계층: 의존 방향"\n  - title: Astryx Markdown\n    url: "https://example.test/docs?x=1#y"\n---\n\n# Design\n\nBody\n`);
 const parsed=parseDesignPreview(text,sid);assert.deepEqual(parsed.sources,sources);
 for(const bad of ['sources:\n  - path: x.md','sources:\n  - title: a\n    path: x.md\n    url: https://a','sources:\n  - title: a\n    url: ftp://a','sources:\n  - title: a\n    path: /abs.md','sources:\n  - title: a\n    path: x.txt','sources: []','sources:\n  - title: a\n    path: x.md\n    extra: 1'])
  assert.throws(()=>parseDesignPreview(`---\nid: ${sid}\n${bad}\n---\n# Design\nBody`,sid),bad);
 const before=parseSpecPreview(path,req,'',doc('Body'));const after=parseSpecPreview(path,req,'',text.replace('Design','Design').replace('Body','Body'));
 assert.deepEqual(compareSpecPreviews([before],[after]).changes.map(c=>[c.id,c.kind,c.types]),[[sid,'design',['modified']]]);
 assert.deepEqual(compareSpecPreviews([before],[after]).changes[0].after.sources,sources);
 const saved=editSpecPreview([before],[{type:'set-design',feature:'posts',title:'Design',body:'Body',sources}],()=>{throw Error('No new identity needed');});
 assert.deepEqual(saved.specs[0].design.sources,sources);
 assert.throws(()=>editSpecPreview([before],[{type:'set-design',feature:'posts',title:'Design',body:'Body',sources:[{title:'x'}]}],()=>''));
 assert.deepEqual(documentLinks({specs:saved.specs,wiki:{documents:[],history:[]}}).map(l=>l.target),['.gitifact/wiki/architecture.md']);
});
test('design revisions never become requirement changes; revert and atomic draft preserve input',()=>{
 const before=parseSpecPreview(path,req,'',doc('First'));const after=parseSpecPreview(path,req,'',doc('Second'));
 assert.deepEqual(compareSpecPreviews([before],[after]).changes.map(c=>[c.id,c.kind,c.types]),[[sid,'design',['modified']]]);
 assert.equal(compareSpecPreviews([before],[before]).changes.length,0);
 const original=JSON.stringify(before);const saved=editSpecPreview([before],[{type:'set-design',feature:'posts',title:'Design',body:'Second'},{type:'delete-design',feature:'posts'}],()=>{throw Error('No new identity needed');});
 assert.equal(saved.specs[0].design,undefined);assert.equal(JSON.stringify(before),original);
});
