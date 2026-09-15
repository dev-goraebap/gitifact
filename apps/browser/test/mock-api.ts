import type { Page } from '@playwright/test';
import { browserSessionV1, repositoryStatusSuccessV1 } from '@gitifact/contracts';

export const session = browserSessionV1.parse({
  contract: 'browser-session',
  version: 1,
  sessionId: 'bb17c554-63a2-47f7-af46-2c3ac17952f1',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
});
export const status = repositoryStatusSuccessV1.parse({
  contract: 'repository-status',
  version: 1,
  ok: true,
  observation: {
    id: '93a9db7a-ef79-44ad-9566-a831c0b02be9',
    startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: '2026-09-13T00:00:01.000Z',
    consistency: 'best-effort',
  },
  repository: { ...session.repository, rootPath: '/fixture/project', objectFormat: 'sha1' },
  head: { state: 'branch', branch: 'main', commit: 'c'.repeat(40) },
  changes: [{ kind: 'tracked', path: 'partial.txt', xy: 'MM', submodule: null }],
  summary: { staged: 1, unstaged: 1, untracked: 0, conflicted: 0 },
  checks: { state: 'not-run', reason: 'git-status-only' },
});
export async function mockApi(page: Page) {
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/v1/specs*', route => route.fulfill({json:specs}));
}

export const specs = {
 contract:'browser-specs',version:1,sessionId:session.sessionId,head:'c'.repeat(40),observedAt:'2026-09-14T00:00:00Z',working:false,
 features:[{id:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md',title:'검색 기능',description:'',requirements:[{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.\n\n조건: 검색어를 입력합니다.\n기대 동작: 결과를 보여줍니다.'}]}],
 events:[{key:'c'.repeat(40)+':R-abcdefghij',commit:'c'.repeat(40),id:'R-abcdefghij',date:'2026-09-14T00:00:00Z',author:'Fixture',email:'fixture@example.test',committer:'Fixture',message:'검색 도입',types:['created'],before:null,after:{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md'},reasons:['사용자가 검색을 요청했습니다.']}],
 contributors:[{name:'Fixture',email:'fixture@example.test',commits:3,latest:'2026-09-14T00:00:00Z'}],contributorsLimited:false,nextCursor:null,boundary:false,
};
