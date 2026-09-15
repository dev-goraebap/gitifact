import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpecPreview, compareSpecPreviews, validatePreviewSnapshot } from '../dist/index.js';
const path = '.gitifact/spec/example/requirements.md';
const req = (id = 'R-v4n6paz2ce', title = '게시물 등록', body = '조건: 등록 요청\n기대 동작: 저장') => `## ${title}\n<!-- gitifact-req: ${id} -->\n\n${body}\n`;
const doc = (body = req(), id = 'S-k7m2xqab3d', title = '게시물') => `<!-- gitifact-spec: ${id} -->\n# ${title}\n\n${body}`;
const parse = (body, id, p = path) => parseSpecPreview(p, doc(body, id));

test('preview preserves original content, ignores fenced fake IDs and normalizes CRLF', () => {
  const source = doc(req() + '\n```md\n## 가짜\n<!-- gitifact-req: R-t3dw5hjk7m -->\n```\n');
  const a = parseSpecPreview(path, source), b = parseSpecPreview(path, source.replaceAll('\n', '\r\n'));
  assert.deepEqual(a, b); assert.equal(a.requirements.length, 1);
  assert.match(a.requirements[0].body, /가짜/);
});
test('preview rejects malformed, ambiguous and duplicate identities', () => {
  for (const s of [doc().replace('S-k7m2xqab3d', 'S-bad'), doc().replace('<!-- gitifact-req:', '<!-- missing:'), doc(req()+req()), doc(req()+'\n```\n'), doc().replace('## 게시물 등록','  ## 게시물 등록'), doc().replace('## 게시물 등록','제목\n---')]) assert.throws(()=>parseSpecPreview(path,s));
  assert.throws(()=>validatePreviewSnapshot([parse(),parse(undefined,'S-u2gk5wd7ra','.gitifact/spec/other/requirements.md')]));
});
test('create, delete, edit, reverted edit and title/path-only spec changes', () => {
  const a = parse();
  assert.deepEqual(compareSpecPreviews([], [a]).changes[0].types, ['created']);
  assert.deepEqual(compareSpecPreviews([a], []).changes[0].types, ['deleted']);
  assert.deepEqual(compareSpecPreviews([a], [parse(req(undefined,'게시물 작성'))]).changes[0].types, ['modified']);
  assert.deepEqual(compareSpecPreviews([a], [parse()]).changes, []);
  const renamed=parseSpecPreview('.gitifact/spec/renamed/requirements.md',doc(req(),undefined,'새 이름'));
  const diff=compareSpecPreviews([a],[renamed]); assert.deepEqual(diff.changes,[]);assert.equal(diff.specChanges.length,1);
});
test('move and move+edit are not delete/create; reasons attach by new history identity', () => {
  const before=[parse(),parse('', 'S-u2gk5wd7ra','.gitifact/spec/other/requirements.md')];
  const history=JSON.stringify({id:'H-b6fq2ry4ns',requirements:['R-v4n6paz2ce'],reason:'잘못된 소속 정정'});
  const after=[parse(''),parseSpecPreview('.gitifact/spec/other/requirements.md',doc(req(),'S-u2gk5wd7ra'),history)];
  const result=compareSpecPreviews(before,after);assert.equal(result.changes.length,1);assert.deepEqual(result.changes[0].types,['moved']);assert.equal(result.changes[0].reasons[0].reason,'잘못된 소속 정정');
  after[1]=parseSpecPreview('.gitifact/spec/other/requirements.md',doc(req(undefined,'새 제목'),'S-u2gk5wd7ra'),history);
  assert.deepEqual(compareSpecPreviews(before,after).changes[0].types,['moved','modified']);
  assert.deepEqual(compareSpecPreviews(after,after).changes,[]);
});
test('invalid JSONL, new dangling links and mutation of old records fail closed', () => {
  assert.throws(()=>parseSpecPreview(path,doc(),'{bad'));
  const history=JSON.stringify({id:'H-b6fq2ry4ns',requirements:['R-t3dw5hjk7m'],reason:'없음'});
  const a=parseSpecPreview(path,doc(),history); assert.throws(()=>compareSpecPreviews([], [a]));
  const b=parseSpecPreview(path,doc(),history.replace('없음','수정'));
  assert.throws(()=>compareSpecPreviews([a],[b]));
});
