import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpec, compareSpecs, validateSpecs } from '../dist/index.js';
const path = '.gitifact/spec/example/requirements.md';
const req = (id = 'R-v4n6paz2ce', title = '게시물 등록', body = '조건: 등록 요청\n기대 동작: 저장') => `## ${title}\n<!-- gitifact-req: ${id} -->\n\n${body}\n`;
const doc = (body = req(), id = 'S-k7m2xqab3d', title = '게시물') => `<!-- gitifact-spec: ${id} -->\n# ${title}\n\n${body}`;
const parse = (body, id, p = path) => parseSpec(p, doc(body, id));

test('parsing preserves original content, ignores fenced fake IDs and normalizes CRLF', () => {
  const source = doc(req() + '\n```md\n## 가짜\n<!-- gitifact-req: R-t3dw5hjk7m -->\n```\n');
  const a = parseSpec(path, source), b = parseSpec(path, source.replaceAll('\n', '\r\n'));
  assert.deepEqual(a, b); assert.equal(a.requirements.length, 1);
  assert.match(a.requirements[0].body, /가짜/);
});
test('parsing rejects malformed, ambiguous and duplicate identities', () => {
  for (const s of [doc().replace('S-k7m2xqab3d', 'S-bad'), doc().replace('<!-- gitifact-req:', '<!-- missing:'), doc(req()+req()), doc(req()+'\n```\n'), doc().replace('## 게시물 등록','  ## 게시물 등록'), doc().replace('## 게시물 등록','제목\n---')]) assert.throws(()=>parseSpec(path,s));
  assert.throws(()=>validateSpecs([parse(),parse(undefined,'S-u2gk5wd7ra','.gitifact/spec/other/requirements.md')]));
});
test('create, delete, edit, reverted edit and title/path-only spec changes', () => {
  const a = parse();
  assert.deepEqual(compareSpecs([], [a]).changes[0].types, ['created']);
  assert.deepEqual(compareSpecs([a], []).changes[0].types, ['deleted']);
  assert.deepEqual(compareSpecs([a], [parse(req(undefined,'게시물 작성'))]).changes[0].types, ['modified']);
  assert.deepEqual(compareSpecs([a], [parse()]).changes, []);
  const renamed=parseSpec('.gitifact/spec/renamed/requirements.md',doc(req(),undefined,'새 이름'));
  const diff=compareSpecs([a],[renamed]); assert.deepEqual(diff.changes,[]);assert.equal(diff.specChanges.length,1);
});
test('move and move+edit are not delete/create; reasons attach by new history identity', () => {
  const before=[parse(),parse('', 'S-u2gk5wd7ra','.gitifact/spec/other/requirements.md')];
  const history=JSON.stringify({id:'H-b6fq2ry4ns',requirements:['R-v4n6paz2ce'],reason:'잘못된 소속 정정'});
  const after=[parse(''),parseSpec('.gitifact/spec/other/requirements.md',doc(req(),'S-u2gk5wd7ra'),history)];
  const result=compareSpecs(before,after);assert.equal(result.changes.length,1);assert.deepEqual(result.changes[0].types,['moved']);assert.equal(result.changes[0].reasons[0].reason,'잘못된 소속 정정');
  after[1]=parseSpec('.gitifact/spec/other/requirements.md',doc(req(undefined,'새 제목'),'S-u2gk5wd7ra'),history);
  assert.deepEqual(compareSpecs(before,after).changes[0].types,['moved','modified']);
  assert.deepEqual(compareSpecs(after,after).changes,[]);
});
test('invalid JSONL, new dangling links and mutation of old records fail closed', () => {
  assert.throws(()=>parseSpec(path,doc(),'{bad'));
  const history=JSON.stringify({id:'H-b6fq2ry4ns',requirements:['R-t3dw5hjk7m'],reason:'없음'});
  const a=parseSpec(path,doc(),history); assert.throws(()=>compareSpecs([], [a]));
  const b=parseSpec(path,doc(),history.replace('없음','수정'));
  assert.throws(()=>compareSpecs([a],[b]));
});
