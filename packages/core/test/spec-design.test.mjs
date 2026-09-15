import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDesignPreview,parseSpecPreview,parsePreviewFiles,compareSpecPreviews,editSpecPreview} from '../dist/index.js';
const sid='S-abcdefghij',rid='R-abcdefghij',path='.gitifact/spec/posts/requirements.md';
const req=`<!-- gitifact-spec: ${sid} -->\n# Posts\n## Save\n<!-- gitifact-req: ${rid} -->\nSave`;
const doc=body=>`<!-- gitifact-design: ${sid} -->\n# Design\n${body}`;
test('design reference grammar ignores fenced examples and validates owner, title and body',()=>{
 const design=parseDesignPreview(doc(`## Flow\n<!-- gitifact-ref: ${rid} -->\n\n\`\`\`md\n<!-- gitifact-ref: invalid -->\n\`\`\``).replace(/\n/g,'\r\n'),sid);
 assert.deepEqual(design.requirements,[rid]);
 for(const input of [doc(''),doc('<!-- gitifact-ref: invalid -->'),doc('# Second title'),doc('```\nopen'),doc('Body').replace(sid,'S-zzzzzzzzzz')])assert.throws(()=>parseDesignPreview(input,sid));
 assert.throws(()=>parsePreviewFiles(new Map([[path.replace('requirements','design'),doc('Orphan')]])));
});
test('design revisions never become requirement changes; revert and atomic draft preserve input',()=>{
 const before=parseSpecPreview(path,req,'',doc('First'));const after=parseSpecPreview(path,req,'',doc('Second'));
 assert.deepEqual(compareSpecPreviews([before],[after]).changes.map(c=>[c.id,c.kind,c.types]),[[sid,'design',['modified']]]);
 assert.equal(compareSpecPreviews([before],[before]).changes.length,0);
 const original=JSON.stringify(before);const saved=editSpecPreview([before],[{type:'set-design',feature:'posts',title:'Design',body:'Second'},{type:'delete-design',feature:'posts'}],()=>{throw Error('No new identity needed');});
 assert.equal(saved.specs[0].design,undefined);assert.equal(JSON.stringify(before),original);
});
