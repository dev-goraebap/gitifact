import type { Page } from '@playwright/test';
import { browserSessionV2, changelogV1, repositoryStatusSuccessV1 } from '@gitifact/contracts';

export const session = browserSessionV2.parse({
  contract: 'browser-session',
  version: 2,
  sessionId: 'bb17c554-63a2-47f7-af46-2c3ac17952f1',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
  cliVersion: '0.4.0',
  update: { status: 'up-to-date', latestVersion: '0.4.0' },
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
export const changelog = changelogV1.parse({
  contract: 'changelog', version: 1, language: 'ko', fallback: false,
  entries: [
    { version: '0.4.0', date: '2026-09-17', added: ['브라우저에 **패치노트** 페이지를 추가했습니다.', '`update` 명령을 추가했습니다.'], changed: ['세션 계약이 version 2가 됐습니다.'], removed: [], fixed: [] },
    { version: '0.3.2', date: '2026-09-16', added: [], changed: [], removed: ['옛 명령을 제거했습니다.'], fixed: ['오타를 고쳤습니다.'] },
  ],
});
export async function mockApi(page: Page) {
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/v1/specs*', route => route.fulfill({json:specs}));
  await page.route('**/api/v1/changelog*', route => route.fulfill({ json: changelog }));
}

export const specs = {
 contract:'browser-specs',version:1,sessionId:session.sessionId,head:'c'.repeat(40),observedAt:'2026-09-14T00:00:00Z',working:false,
 features:[{id:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md',title:'검색 기능',description:'',contributors:[{name:'Fixture',email:'fixture@example.test',commits:2,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],updatedAt:'2026-09-14T00:00:00Z',requirements:[{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.\n\n조건: 검색어를 입력합니다.\n기대 동작: 결과를 보여줍니다.'}]}],
 events:[{key:'c'.repeat(40)+':R-abcdefghij',commit:'c'.repeat(40),id:'R-abcdefghij',date:'2026-09-14T00:00:00Z',author:'Fixture',email:'fixture@example.test',committer:'Fixture',message:'검색 도입',types:['created'],before:null,after:{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md'},reasons:['사용자가 검색을 요청했습니다.']}],
 documents:[{id:'P-abcdefghij',kind:'product',path:'.gitifact/product/PRODUCT.md',title:'Gitifact',body:'요구사항과 변경 이유를 **Git**에 연결합니다.\n\n![로고](./logo.png)',updatedAt:'2026-09-14T00:00:00Z'},{id:'G-abcdefghij',kind:'guide',path:'.gitifact/guides/frontend/layout.md',title:'레이아웃 지침',body:'중앙 컬럼은 64rem입니다.',updatedAt:'2026-09-14T00:00:00Z'},{id:'G-bbbbbbbbbb',kind:'guide',path:'.gitifact/guides/naming.md',title:'이름 규칙',body:'소문자와 하이픈을 씁니다.',updatedAt:null}],
 contributors:[{name:'Fixture',email:'fixture@example.test',commits:3,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],contributorsLimited:false,nextCursor:null,boundary:false,
};
