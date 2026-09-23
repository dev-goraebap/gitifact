import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDesign,parseSpec,parseSpecFiles,compareSpecs} from '../dist/index.js';
const sid='S-abcdefghij',rid='R-abcdefghij',path='.gitifact/spec/posts/requirements.md';
const req=`---\nid: ${sid}\n---\n# Posts\n## Save\n<!-- gitifact-req: ${rid} -->\nSave`;
const doc=body=>`---\nid: ${sid}\n---\n# Design\n${body}`;
const legacy=body=>`<!-- gitifact-design: ${sid} -->\n# Design\n${body}`;
test('design reference grammar ignores fenced examples and validates owner, title and body',()=>{
 const design=parseDesign(doc(`## Flow\n<!-- gitifact-ref: ${rid} -->\n\n\`\`\`md\n<!-- gitifact-ref: invalid -->\n\`\`\``).replace(/\n/g,'\r\n'),sid);
 assert.deepEqual(design.requirements,[rid]);assert.deepEqual(design.sources,[]);
 // Designs written by 0.4.x open with a marker line and still read from history.
 assert.equal(parseDesign(legacy('Body'),sid).body,'Body');
 for(const input of [doc(''),doc('<!-- gitifact-ref: invalid -->'),doc('# Second title'),doc('```\nopen'),doc('Body').replace(sid,'S-zzzzzzzzzz'),legacy('Body').replace(sid,'S-zzzzzzzzzz')])assert.throws(()=>parseDesign(input,sid));
 assert.throws(()=>parseSpecFiles(new Map([[path.replace('requirements','design'),doc('Orphan')]])));
});
test('sources read from the frontmatter, quoted values and all, and count as a design change',()=>{
 const sources=[{title:'아키텍처',path:'../../wiki/architecture.md',note:'계층: 의존 방향'},{title:'Astryx Markdown',url:'https://example.test/docs?x=1#y'}];
 // A design as 0.7 wrote it; only reading is left, so the text is the fixture rather than something rendered here.
 const text=`---\nid: ${sid}\nsources:\n  - title: 아키텍처\n    path: ../../wiki/architecture.md\n    note: "계층: 의존 방향"\n  - title: Astryx Markdown\n    url: "https://example.test/docs?x=1#y"\n---\n\n# Design\n\nBody\n`;
 const parsed=parseDesign(text,sid);assert.deepEqual(parsed.sources,sources);
 for(const bad of ['sources:\n  - path: x.md','sources:\n  - title: a\n    path: x.md\n    url: https://a','sources:\n  - title: a\n    url: ftp://a','sources:\n  - title: a\n    path: /abs.md','sources:\n  - title: a\n    path: x.txt','sources: []','sources:\n  - title: a\n    path: x.md\n    extra: 1'])
  assert.throws(()=>parseDesign(`---\nid: ${sid}\n${bad}\n---\n# Design\nBody`,sid),bad);
 const before=parseSpec(path,req,'',doc('Body'));const after=parseSpec(path,req,'',text.replace('Design','Design').replace('Body','Body'));
 assert.deepEqual(compareSpecs([before],[after]).changes.map(c=>[c.id,c.kind,c.types]),[[sid,'design',['modified']]]);
 assert.deepEqual(compareSpecs([before],[after]).changes[0].after.sources,sources);
});
test('design revisions never become requirement changes',()=>{
 const before=parseSpec(path,req,'',doc('First'));const after=parseSpec(path,req,'',doc('Second'));
 assert.deepEqual(compareSpecs([before],[after]).changes.map(c=>[c.id,c.kind,c.types]),[[sid,'design',['modified']]]);
 assert.equal(compareSpecs([before],[before]).changes.length,0);
});
