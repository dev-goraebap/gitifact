import type { Page } from '@playwright/test';
import { browserSessionV3, changelogV1, repositoryStatusSuccessV1, type BrowserSpecsV6, type CommitFile, type DesignSource, type SpecEvent, type SpecFeature, type SpecInstruction, type AgentsFile } from '@gitifact/contracts';

export const session = browserSessionV3.parse({
  contract: 'browser-session',
  version: 3,
  sessionId: 'bb17c554-63a2-47f7-af46-2c3ac17952f1',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
  cliVersion: '0.4.0',
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

/** A requirement or design as tests write it: paths, descriptions and order are filled in when left out. */
type LooseRequirement = { id: string; title: string; body: string; path?: string; description?: string; order?: number };
type LooseDesign = { id?: string; title: string; body: string; requirements: string[]; sources: DesignSource[]; path?: string; description?: string; order?: number };
type LooseFeature = Omit<SpecFeature, 'requirements' | 'designs' | 'body'> & { requirements: LooseRequirement[]; designs?: LooseDesign[]; design?: LooseDesign | undefined; body?: string };
/** An instruction as tests write it: what is left out is filled in (no other files, never committed). */
type LooseInstruction = Pick<SpecInstruction, 'id' | 'name' | 'title' | 'body'> & Partial<SpecInstruction>;
/** A checkout with the history the mock serves beside it, in a shorthand the tests can write by hand. */
export type Fixture = Omit<BrowserSpecsV6, 'version' | 'features' | 'instructions' | 'agents' | 'problems'> & { version?: number; features: LooseFeature[];
  instructions?: LooseInstruction[]; agents?: AgentsFile | null; problems?: BrowserSpecsV6['problems']; events: SpecEvent[] };
/** Joins a relative link onto the folder of `from`, as a document link resolves. */
const joined = (from: string, href: string) => { const parts = from.split('/').slice(0, -1); for (const p of href.split('/')) { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); } return parts.join('/'); };
/** The checkout part of a fixture, as /api/v1/specs answers it: the shorthand filled out to the v6 shape. */
export const checkoutOf = ({ events: _events, features, instructions, agents, problems, ...rest }: Fixture): BrowserSpecsV6 => ({ ...rest, version: 6,
  features: features.map(({ design, designs, requirements, body, ...f }) => {
    const path = f.path.replace(/requirements\.md$/, 'index.md'); const folder = path.replace(/\/index\.md$/, '');
    // A design written the old way names its sources relative to design.md; they become repository paths.
    const all = designs ?? (design ? [design] : []);
    return { ...f, path, body: body ?? (f.description || f.title),
      requirements: requirements.map((r, i) => ({ path: `${folder}/requirements/${r.id.toLowerCase()}.md`, description: r.title, order: (i + 1) * 10, ...r })),
      designs: all.map((d, i) => ({ id: 'D-' + f.id.slice(2, 11) + i, path: `${folder}/design/${i ? 'part-' + i : 'overview'}.md`, description: d.title, order: (i + 1) * 10, ...d,
        sources: d.sources.map(s => s.path ? { ...s, path: joined(folder + '/design.md', s.path) } : s) })) };
  }),
  instructions: (instructions ?? []).map(k => ({ path: `.gitifact/instructions/${k.name}/index.md`, description: k.title + ' 설명', files: [], filesLimited: false, updatedAt: null, ...k })),
  agents: agents ?? null,
  problems: problems ?? [] });
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
  const checkout = checkoutOf(data);
  await page.route('**/api/v1/specs*', route => route.fulfill({ json: checkout }));
  await page.route(url => url.pathname === '/api/v1/history', route => {
    const q = new URL(route.request().url()).searchParams;
    const matching = events.filter(e => (!q.get('kind') || e.types.includes(q.get('kind') as never)) && (!q.get('document') || e.kind === q.get('document'))
      && (!q.get('feature') || e.before?.specId === q.get('feature') || e.after?.specId === q.get('feature')) && (!q.get('author') || e.email === q.get('author')) && (!q.get('id') || e.id === q.get('id'))
      && (!q.get('q') || lower([e.id, e.before?.title, e.after?.title].join(' ')).includes(lower(q.get('q')!))));
    const offset = Number(q.get('offset') ?? 0); const limit = Number(q.get('limit') ?? 50);
    return route.fulfill({ json: { contract: 'browser-history', version: 4, sessionId: session.sessionId, head: data.head, total: matching.length, offset, events: matching.slice(offset, offset + limit) } });
  });
  await page.route('**/api/v1/history/summary*', route => {
    const commits = [...new Set(events.map(e => e.commit))];
    const count = (type: string) => events.filter(e => e.types.includes(type as never)).length;
    return route.fulfill({ json: { contract: 'browser-history-summary', version: 3, sessionId: session.sessionId, head: data.head, total: events.length,
      byType: { created: count('created'), modified: count('modified'), moved: count('moved'), deleted: count('deleted') },
      pulse: commits.map(c => ({ date: events.find(e => e.commit === c)!.date, count: events.filter(e => e.commit === c).length })),
      recent: commits.slice(0, 3).map(c => ({ commit: c, count: events.filter(e => e.commit === c).length, events: events.filter(e => e.commit === c).slice(0, 12) })) } });
  });
  // One commit as its page reads it: the events of that commit with whatever bodies the fixture gave them.
  await page.route(url => url.pathname === '/api/v1/commit', route => {
    const commit = new URL(route.request().url()).searchParams.get('commit') ?? '';
    const own = events.filter(e => e.commit === commit);
    const first = own[0];
    if (!first) return route.fulfill({ status: 404, json: notFound });
    const side = (s: Side, event: SpecEvent) => s && { kind: event.kind, description: '', ...s };
    return route.fulfill({ json: { contract: 'browser-commit', version: 2, sessionId: session.sessionId, commit,
      author: first.author, email: first.email, committer: first.committer, date: first.date, message: first.message,
      changes: own.map(event => ({
        event,
        before: side(changeBodies[event.key]?.before ?? (event.before && { ...event.before, body: '' }), event),
        after: side(changeBodies[event.key]?.after ?? (event.after && { ...event.after, body: '' }), event),
      })) } });
  });

  // The source a commit changed: none unless a test lists some in commitSources.
  await page.route(url => url.pathname === '/api/v1/commit/files', route => {
    const commit = new URL(route.request().url()).searchParams.get('commit') ?? '';
    const files = (commitSources[commit] ?? []).map(s => s.file);
    return route.fulfill({ json: { contract: 'browser-commit-files', version: 1, sessionId: session.sessionId, commit, total: files.length, files } });
  });
  await page.route(url => url.pathname === '/api/v1/commit/file', route => {
    const q = new URL(route.request().url()).searchParams; const commit = q.get('commit') ?? '';
    const found = (commitSources[commit] ?? []).find(s => s.file.path === q.get('path'));
    return found ? route.fulfill({ json: { contract: 'browser-commit-file', version: 1, sessionId: session.sessionId, commit, binary: false, tooLarge: false, ...found } })
      : route.fulfill({ status: 404, json: notFound });
  });
  await page.route('**/api/v1/search*', route => {
    const query = lower(new URL(route.request().url()).searchParams.get('q') ?? '');
    const records = [
      ...checkout.features.flatMap(f => [{ id: f.id, kind: 'feature', title: f.title, where: f.path.replace(/^\.gitifact\//, ''), body: f.description, featureId: f.id },
        ...f.requirements.map(r => ({ id: r.id, kind: 'requirement', title: r.title, where: f.title, body: r.body, featureId: f.id }))]),
      ...checkout.instructions.map(k => ({ id: k.id, kind: 'instruction', title: k.title, where: k.name, body: k.description + ' ' + k.body })),
    ].map(r => ({ ...r, body: plainText(r.body) })).filter(r => [r.title, r.where, r.body].some(text => lower(text).includes(query)));
    const past = events.filter(e => lower([(e.after ?? e.before)?.title ?? '', ...e.reasons].join(' ')).includes(query))
      .map(e => ({ id: e.key, kind: 'history', title: (e.after ?? e.before)?.title ?? e.id, where: e.commit.slice(0, 7) + ' · ' + e.author, line: e.reasons.join(' · '), key: e.key }));
    return route.fulfill({ json: { contract: 'browser-search', version: 2, sessionId: session.sessionId, query,
      hits: [...records.map(({ body, ...r }) => ({ ...r, line: line(body, query) })), ...past] } });
  });
  // One file of an instruction folder: the text a test put in instructionFiles, or not found.
  await page.route(url => url.pathname === '/api/v1/instructions/file', route => {
    const q = new URL(route.request().url()).searchParams; const id = q.get('id') ?? ''; const path = q.get('path') ?? '';
    const found = instructionFiles[id + ':' + path];
    return found ? route.fulfill({ json: { contract: 'browser-instruction-file', version: 1, sessionId: session.sessionId, id, path, size: found.text?.length ?? 0, binary: false, tooLarge: false, ...found } })
      : route.fulfill({ status: 404, json: notFound });
  });
}
/** Text of instruction folder files by `<instruction id>:<path>`, for the instruction page's file view. */
export const instructionFiles: Record<string, { text: string | null; binary?: boolean; tooLarge?: boolean }> = {};

export const specs: Fixture = {
 contract:'browser-specs',version:6,sessionId:session.sessionId,head:'c'.repeat(40),observedAt:'2026-09-14T00:00:00Z',working:false,
 features:[{id:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md',title:'검색 기능',description:'',contributors:[{name:'Fixture',email:'fixture@example.test',commits:2,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],updatedAt:'2026-09-14T00:00:00Z',requirements:[{id:'R-abcdefghij',title:'검색어 입력',body:'**검색어**를 입력합니다.\n\n조건: 검색어를 입력합니다.\n기대 동작: 결과를 보여줍니다.'}]}],
 events:[{key:'c'.repeat(40)+':R-abcdefghij',commit:'c'.repeat(40),id:'R-abcdefghij',date:'2026-09-14T00:00:00Z',author:'Fixture',email:'fixture@example.test',committer:'Fixture',message:'검색 도입',types:['created'],before:null,after:{id:'R-abcdefghij',title:'검색어 입력',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements.md'},kind:'requirement',reasons:['사용자가 검색을 요청했습니다.']}],
 instructions:[{id:'I-bbbbbbbbbb',name:'layout',title:'레이아웃 지침',description:'열과 폭',body:'중앙 컬럼은 64rem입니다.',updatedAt:'2026-09-14T00:00:00Z'},{id:'I-cccccccccc',name:'naming',title:'이름 규칙',description:'이름 짓기',body:'소문자와 하이픈을 씁니다.'}],
 contributors:[{name:'Fixture',email:'fixture@example.test',commits:3,latest:'2026-09-14T00:00:00Z'},{name:'Second',email:'second@example.test',commits:1,latest:'2026-09-13T00:00:00Z'}],contributorsLimited:false,
};

type Side = { id: string; title: string; body: string; specId: string; path: string; kind?: SpecEvent['kind']; description?: string; sources?: DesignSource[]; requirements?: string[] } | null;
/** The text on both sides of each listed change, as the change endpoint returns it. Tests add entries for their own events. */
/** Source files per commit with both sides, for the activity detail's source section. */
export const commitSources: Record<string, { file: CommitFile; before: string | null; after: string | null; binary?: boolean }[]> = {};
export const changeBodies: Record<string, { before: Side; after: Side }> = {
  ['c'.repeat(40) + ':R-abcdefghij']: { before: null, after: { id: 'R-abcdefghij', title: '검색어 입력', body: '**검색어**를 입력합니다.', specId: 'S-abcdefghij', path: '.gitifact/spec/search/requirements.md' } },
};
