import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequirements, requirementDocument, requirementViews } from '../dist/index.js';
const id = 'R-search-abcdefghij';
const revision = { id: '11111111-1111-4111-8111-111111111111', title: '검색', text: '검색 결과를 표시한다.', author: 'Codex', reason: '사용자 요청', at: '2026-09-13T00:00:00.000Z' };
const base = () => ({ kind: 'tryce-requirements', format: 'requirements-1', spec: 'search', requirements: [{ id, revisions: [revision] }], reviews: [], decisions: [] });
test('requirements reject unknown fields, dangling references, duplicate revisions and invalid decisions', () => {
  for (const edit of [s => { s.extra = true; }, s => { s.requirements[0].revisions.push(revision); }, s => { s.decisions.push({ review: 'missing' }); }, s => { s.spec = '../escape'; }]) {
    const s = base(); edit(s); assert.throws(() => parseRequirements(s), { code: 'INVALID_REQUIREMENTS' });
  }
});
test('active auto requirements carry no user approval and a new revision remains draft', () => {
  const s = base(); const review = { id: '22222222-2222-4222-8222-222222222222', at: revision.at, items: [{ id, revision: revision.id, document: requirementDocument(s.requirements[0], revision), blob: 'a'.repeat(40) }] };
  s.reviews.push(review); s.decisions.push({ review: review.id, kind: 'auto', actor: 'Codex', evidence: 'Clear user intent', at: revision.at, mode: 'auto' });
  assert.equal(requirementViews(parseRequirements(s))[0].approval, 'not-approved'); assert.equal(requirementViews(s)[0].state, 'active');
  s.requirements[0].revisions.push({ ...revision, id: '33333333-3333-4333-8333-333333333333', text: '명확한 설명' });
  const view = requirementViews(parseRequirements(s))[0]; assert.equal(view.state, 'draft'); assert.equal(view.id, id); assert.equal(view.confirmedBefore, true);
  s.reviews[0].items[0].document = 'changed'; assert.throws(() => parseRequirements(s), { code: 'INVALID_REQUIREMENTS' });
});
