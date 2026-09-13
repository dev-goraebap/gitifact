import assert from 'node:assert/strict';
import test from 'node:test';
import { briefV1, briefV2, workflowV1 } from '../dist/index.js';
const sample = () => ({ contract:'brief',version:1,ok:true,report:{
  observation:{id:'12345678-1234-4234-8234-123456789abc',startedAt:'2026-09-13T00:00:00.000Z',completedAt:'2026-09-13T00:00:01.000Z',consistency:'best-effort'},
  repository:{key:'repo:'+'a'.repeat(64),worktreeKey:'worktree:'+'b'.repeat(64),rootPath:'/repo',objectFormat:'sha1'},
  git:{head:{state:'unborn',branch:'main',commit:null},summary:{staged:0,unstaged:0,untracked:0,conflicted:0},changes:{total:0,included:0,omitted:0,items:[]},source:'head-index-working-tree'},
  project:{state:'not-available',reason:'not-initialized'},notes:{state:'not-available',reason:'notes-not-enabled'},documents:{state:'available',data:{total:0,included:0,omitted:0,items:[]}},
  scope:{all:false,notes:'working-tree',documents:'root-AGENTS-README-and-docs-markdown'},checks:{state:'not-run',reason:'brief-is-observation-only'},
  unsupported:['requirement-state','task-state','open-questions','history-analysis','skill-discovery'],
  followUp:{complete:'tryce brief --all',notes:'tryce note list',note:'tryce note show <id>',git:'tryce status'},
}});
test('brief validates omission accounting, failure state and source without claiming checks ran', () => {
  const value=sample(); assert.deepEqual(briefV1.parse(JSON.parse(JSON.stringify(value))),value);
  for (const mutate of [v=>{v.version=2;},v=>{v.report.checks.state='clean';},v=>{v.report.git.changes.total=1;},v=>{v.report.notes={state:'error',error:{code:'INVALID_NOTE',message:'bad'}};}]) {
    const invalid=sample(); mutate(invalid); assert.equal(briefV1.safeParse(invalid).success,false);
  }
  const partial=sample(); partial.ok=false; partial.error={code:'INCOMPLETE_BRIEF',message:'partial'};
  partial.report.notes={state:'error',error:{code:'INVALID_NOTE',message:'bad'}};
  assert.equal(briefV1.parse(partial).ok,false);
  assert.equal(briefV1.parse({contract:'brief',version:1,ok:false,report:null,error:{code:'GIT_FAILED',message:'failed'}}).report,null);
});
test('workflow brief preserves explicit unassessed states and rejects successful partial errors', () => {
  const value = sample(); value.version = 2;
  value.report.project = { state: 'available', data: { source: 'working-tree', path: '.tryce/config.json', format: 'workflow-1', mode: 'approval', baseline: { kind: 'empty' }, baselineVerified: true } };
  value.report.requirements = { state: 'available', data: { total: 1, included: 1, omitted: 0, items: [{ id: 'R-search-abcdefghij', revision: '11111111-1111-4111-8111-111111111111', title: '검색', state: 'active', approval: 'approved', path: '.tryce/spec/search/tryce.json', implementation: 'not-assessed', verification: 'not-run' }] } };
  assert.equal(briefV2.parse(value).report.requirements.data.items[0].verification, 'not-run');
  value.report.requirements = { state: 'error', error: { code: 'INVALID_REQUIREMENTS', message: 'broken' } };
  assert.equal(briefV2.safeParse(value).success, false);
  assert.equal(workflowV1.safeParse({ contract: 'workflow', version: 1, ok: true, command: 'req.list', data: { items: [] } }).success, true);
  assert.equal(workflowV1.safeParse({ contract: 'workflow', version: 2, ok: true, command: 'req.list', data: {} }).success, false);
});
