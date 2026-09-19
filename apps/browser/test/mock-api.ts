import type { Page } from '@playwright/test';
import { browserSessionV2, changelogV1, repositoryStatusSuccessV1, type BrowserSpecsV4, type SpecEvent } from '@gitifact/contracts';

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
export async function mockApi(page: Page, data: Fixture = specs) {
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/v1/changelog*', route => route.fulfill({ json: changelog }));
  // Store assets are not part of the fixture; answer instead of proxying to a CLI that is not running.
  await page.route('**/api/v1/assets/**', route => route.fulfill({ status: 404, body: '' }));
  await serve(page, data);
}

/** A checkout with the history the mock serves beside it. */
export type Fixture = BrowserSpecsV4 & { events: SpecEvent[]; boundary: boolean };
/** The checkout part of a fixture, as /api/v1/specs answers it. */
export const checkoutOf = ({ events: _events, boundary: _boundary, ...checkout }: Fixture) => checkout;
const lower = (text: string) => text.toLowerCase();
const plainText = (text: string) => text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
const line = (text: string, query: string) => { const at = lower(text).indexOf(query); return at < 0 ? text.slice(0, 90) : text.slice(Math.max(0, at - 30), at + query.length + 70); };
const notFound = { contract: 'browser-http-error', version: 1, error: { code: 'NOT_FOUND', message: 'no change' } };

/**
 * Answers the record routes from one fixture the way the CLI does: the checkout whole, and history filtered, paged,
 * counted and searched over all of the fixture's events. Tests call it again to swap in their own fixture.
 */
export async function serve(page: Page, data: Fixture) {
  const events = data.events;
  await page.route('**/api/v1/specs*', route => route.fulfill({ json: checkoutOf(data) }));
  await page.route(url => url.pathname === '/api/v1/history', route => {
    const q = new URL(route.request().url()).searchParams;
    const matching = events.filter(e => (!q.get('kind') || e.types.includes(q.get('kind') as never)) && (!q.get('document') || e.kind === q.get('document'))
      && (!q.get('feature') || e.before?.specId === q.get('feature') || e.after?.specId === q.get('feature')) && (!q.get('author') || e.email === q.get('author'))
      && (!q.get('q') || lower([e.id, e.before?.title, e.after?.title].join(' ')).includes(lower(q.get('q')!))));
    const offset = Number(q.get('offset') ?? 0); const limit = Number(q.get('limit') ?? 50);
    return route.fulfill({ json: { contract: 'browser-history', version: 1, sessionId: session.sessionId, head: data.head, total: matching.length, offset, events: matching.slice(offset, offset + limit), boundary: data.boundary } });
  });
  await page.route('**/api/v1/history/summary*', route => {
    const commits = [...new Set(events.map(e => e.commit))];
    const count = (type: string) => events.filter(e => e.types.includes(type as never)).length;
    return route.fulfill({ json: { contract: 'browser-history-summary', version: 1, sessionId: session.sessionId, head: data.head, total: events.length,
      byType: { created: count('created'), modified: count('modified'), moved: count('moved'), deleted: count('deleted') },
      pulse: commits.map(c => ({ date: events.find(e => e.commit === c)!.date, count: events.filter(e => e.commit === c).length })),
      recent: commits.slice(0, 3).map(c => ({ commit: c, count: events.filter(e => e.commit === c).length, events: events.filter(e => e.commit === c).slice(0, 12) })) } });
  });
  // The list carries no bodies; opening an entry asks for its text by key.
  // An exact path: a pattern ending in change* would also answer /api/v1/changelog.
  await page.route(url => url.pathname === '/api/v1/change', route => {
    const key = new URL(route.request().url()).searchParams.get('key') ?? '';
    const event = events.find(e => e.key === key); const change = changeBodies[key];
    return event && change ? route.fulfill({ json: { contract: 'browser-change', version: 1, sessionId: session.sessionId, event, ...change } })
      : route.fulfill({ status: 404, json: notFound });
  });
  await page.route('**/api/v1/search*', route => {
    const query = lower(new URL(route.request().url()).searchParams.get('q') ?? '');
    const records = [
      ...data.features.flatMap(f => [{ id: f.id, kind: 'feature', title: f.title, where: f.path.replace(/^\.gitifact\//, ''), body: f.description, featureId: f.id },
        ...f.requirements.map(r => ({ id: r.id, kind: 'requirement', title: r.title, where: f.title, body: r.body, featureId: f.id }))]),
      ...data.documents.map(d => ({ id: d.id, kind: 'document', title: d.title, where: d.path.replace(/^\.gitifact\/wiki\//, ''), body: d.body, documentId: d.id })),
    ].map(r => ({ ...r, body: plainText(r.body) })).filter(r => [r.title, r.where, r.body].some(text => lower(text).includes(query)));
    const past = events.filter(e => lower([(e.after ?? e.before)?.title ?? '', ...e.reasons].join(' ')).includes(query))
      .map(e => ({ id: e.key, kind: 'history', title: (e.after ?? e.before)?.title ?? e.id, where: e.commit.slice(0, 7) + ' · ' + e.author, line: e.reasons.join(' · '), key: e.key }));
    return route.fulfill({ json: { contract: 'browser-search', version: 1, sessionId: session.sessionId, query,
      hits: [...records.map(({ body, ...r }) => ({ ...r, line: line(body, query) })), ...past] } });
  });
}

// The entry page links a store asset, a sibling wiki page, a repository file outside the store, a page that does not exist and a feature design.
export const readmeBody = '요구사항과 변경 이유를 **Git**에 연결합니다.\n\n![로고](../assets/logo.png)\n\n[레이아웃 지침](frontend/layout.md) · [개발 환경](../../docs/development.md) · [없는 페이지](missing.md) · [검색 설계](../spec/search/design.md)';
export const specs: Fixture = {
 contract:'browser-specs',version:4,sessionId:session.sessionId,head:'c'.repeat(40),observedAt:'2026-09-14T00:00:00Z',working:false,
 features:[{id:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md',title:'검색 기능',description:'',contributors:[{name:'Fixture',email:'fixture@example.test',commits:2,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],updatedAt:'2026-09-14T00:00:00Z',requirements:[{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.\n\n조건: 검색어를 입력합니다.\n기대 동작: 결과를 보여줍니다.'}]}],
 events:[{key:'c'.repeat(40)+':R-abcdefghij',commit:'c'.repeat(40),id:'R-abcdefghij',date:'2026-09-14T00:00:00Z',author:'Fixture',email:'fixture@example.test',committer:'Fixture',message:'검색 도입',types:['created'],before:null,after:{id:'R-abcdefghij',title:'검색어 입력',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md'},kind:'requirement',reasons:['사용자가 검색을 요청했습니다.']}],
 documents:[{id:'W-abcdefghij',path:'.gitifact/wiki/README.md',title:'Gitifact',body:readmeBody,updatedAt:'2026-09-14T00:00:00Z'},{id:'W-bbbbbbbbbb',path:'.gitifact/wiki/frontend/layout.md',title:'레이아웃 지침',body:'중앙 컬럼은 64rem입니다.',updatedAt:'2026-09-14T00:00:00Z'},{id:'W-cccccccccc',path:'.gitifact/wiki/naming.md',title:'이름 규칙',body:'소문자와 하이픈을 씁니다.',updatedAt:null}],
 contributors:[{name:'Fixture',email:'fixture@example.test',commits:3,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],contributorsLimited:false,boundary:false,
};

type Side = { id: string; title: string; body: string; specId: string; path: string } | null;
/** The text on both sides of each listed change, as the change endpoint returns it. Tests add entries for their own events. */
export const changeBodies: Record<string, { before: Side; after: Side }> = {
  ['c'.repeat(40) + ':R-abcdefghij']: { before: null, after: { id: 'R-abcdefghij', title: '검색어 입력', body: '**검색어**를 입력합니다.', specId: 'S-abcdefghij', path: '.gitifact/spec/search/requirements.md' } },
};
