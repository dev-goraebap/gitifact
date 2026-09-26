import { expect, test } from '@playwright/test';
import { mockApi, specs, status, serve } from './mock-api';

test('wiki changes from before the wiki left the browser stay in the activity with their kind', async ({ page }) => {
  await mockApi(page);
  const event = specs.events[0]!;
  const data = { ...structuredClone(specs), events: [{ ...event, key: specs.head + ':W-bbbbbbbbbb', id: 'W-bbbbbbbbbb', kind: 'wiki' as const, types: ['modified' as const],
    before: { id: 'W-bbbbbbbbbb', title: '레이아웃 지침', specId: 'wiki', path: '.gitifact/wiki/layout.md' },
    after: { id: 'W-bbbbbbbbbb', title: '레이아웃 지침', specId: 'wiki', path: '.gitifact/wiki/frontend/layout.md' }, records:[{id:'H-wwwwwwwwww',title:'폴더를 정리했습니다.',sections:[{key:'context' as const,body:'폴더를 정리했습니다.'}]}] }] };
  await serve(page, data);
  await page.goto('/records?document=wiki');
  const rows = page.getByRole('list', { name: '이 결정으로 바뀐 문서' }).getByRole('listitem'); await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('위키 페이지');
  // A wiki page is named by its title alone; no feature stands before it and no path after it.
  await expect(rows.first()).not.toContainText('frontend/layout.md');
  await expect(rows.first()).not.toContainText('/');
  await rows.first().getByRole('link', { name: '레이아웃 지침' }).click();
  const pane = page.getByRole('article', { name: '결정기록 상세' });
  await expect(pane).toContainText('레이아웃 지침');
  // There is no wiki page to open any more.
  await expect(pane.getByRole('link', { name: '현재 문서 보기 →' })).toHaveCount(0);
  await page.goto('/wiki');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다');
});

test('the product page leads with what changed and why', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  const article = page.getByRole('article', { name: '대시보드' });
  // The project leads; the counts orient below it.
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('project');
  const summary = article.getByLabel('현재 명세 요약');
  await expect(summary).toContainText('기능 명세');
  await expect(summary).toContainText('프로젝트 지침');
  // The two loaded-range bars keep their legends above the reasons.
  await expect(article.getByLabel('변경 종류 범례').getByRole('listitem').first()).toHaveText('추가1 · 100%');
  await expect(article.getByLabel('참여자별 커밋 범례').getByRole('listitem').first()).toHaveText('Fixture3 · 75%');
  // The recorded reason is the subject of the section below them, next to the record it explains.
  const reasons = article.getByLabel('최신 활동');
  await expect(reasons).toContainText('사용자가 검색을 요청했습니다.');
  await expect(reasons).toContainText('검색어 입력');
  await reasons.getByRole('link', { name: '검색어 입력' }).click();
  await expect(page).toHaveURL(/\/records\/H-[a-z0-9]+#R-/);
  await page.goBack();
  // The overview draws the activity screen's own timeline, so its parts are here too.
  await expect(reasons.getByRole('list', { name: '결정기록 목록' })).toHaveCount(1);
  await expect(reasons.getByRole('list', { name: '이 결정으로 바뀐 문서' })).toHaveCount(1);
  // One way into the activity timeline, not two.
  await expect(article.getByRole('link', { name: '결정기록 →' })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  await expect(page.locator('header[aria-label="현재 위치"]')).toContainText('조회');
  await expect(page.getByText('로컬 읽기 전용', { exact: false })).toHaveCount(0);
});

test('uncommitted spec changes mark the Git menu and are explained on the Git page instead of above the lists', async ({ page }) => {
  await mockApi(page);
  await serve(page, { ...specs, working: true });
  await page.goto('/features');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('기능별 요구사항');
  await expect(page.getByText('작업 중인 내용이고', { exact: false })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '사이드 탐색' });
  await expect(nav.getByLabel('미커밋 명세 변경 있음')).toBeVisible();
  await nav.getByRole('link', { name: /^Git 상태/ }).click();
  await expect(page.getByText('대시보드·기능별 요구사항·프로젝트 지침 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: '요구사항 보기 →' }).click();
  await expect(page).toHaveURL(/\/features$/);
});

test('a direct visit to the Git page reads uncommitted store paths from the repository status', async ({ page }) => {
  await mockApi(page);
  const data = { ...status, changes: [...status.changes, { kind: 'tracked', path: '.gitifact/spec/search/requirements.md', xy: '.M', submodule: null }], summary: { ...status.summary, unstaged: 2 } };
  await page.route('**/api/v1/status', r => r.fulfill({ json: data }));
  await page.goto('/git');
  await expect(page.getByText('대시보드·기능별 요구사항·프로젝트 지침 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '사이드 탐색' }).getByLabel('미커밋 명세 변경 있음')).toBeVisible();
});

test('the two overview charts share one height even when one legend wraps', async ({ page }) => {
  await mockApi(page);
  const many = structuredClone(specs);
  many.contributors = Array.from({ length: 7 }, (_, i) => ({ name: 'Person ' + i, email: `p${i}@example.test`, commits: 10 - i, latest: '2026-09-14T00:00:00Z' }));
  await serve(page, many);
  await page.goto('/dashboard');
  const card = (name: string) => page.getByRole('heading', { level: 3, name }).locator('xpath=ancestor::*[parent::*[contains(@class,"astryx-grid") or contains(@style,"grid")]][1]');
  await expect(page.getByRole('heading', { level: 3, name: '참여자별 커밋' })).toBeVisible();
  const heights = await Promise.all(['변경 종류', '참여자별 커밋'].map(async name => Math.round((await card(name).boundingBox())!.height)));
  expect(heights[0]).toBe(heights[1]);
});

test('a commit that touched a great many documents shows three under its record and carries on to the record and the commit', async ({ page }) => {
  await mockApi(page);
  const event = specs.events[0]!;
  // One introducing commit with 25 records; the server sends the first twelve and the whole count.
  const data = { ...structuredClone(specs), events: Array.from({ length: 25 }, (_, i) =>
    ({ ...event, key: specs.head + ':R-' + 'abcdefghij'.slice(0, 8) + 'abcdefghijklmnopqrstuvwxyz234567'[i >> 5] + 'abcdefghijklmnopqrstuvwxyz234567'[i & 31],
      id: 'R-' + 'abcdefghij'.slice(0, 8) + 'abcdefghijklmnopqrstuvwxyz234567'[i >> 5] + 'abcdefghijklmnopqrstuvwxyz234567'[i & 31],
      after: { ...event.after!, title: '도입 기록 ' + i } })) };
  await serve(page, data);
  await page.goto('/dashboard');
  const activity = page.getByRole('article', { name: '대시보드' }).getByLabel('최신 활동');
  // The record lists three of the ten documents the overview holds and leaves the rest to its page.
  await expect(activity.getByRole('list', { name: '이 결정으로 바뀐 문서' }).getByRole('listitem')).toHaveCount(3);
  await expect(activity.getByRole('link', { name: '문서 7건 더 →' })).toHaveAttribute('href', /\/records\/H-aaaaaaaaaa$/);
  // The count names every document of the commit, and the link accounts for the ones the overview did not load.
  await expect(activity).toContainText('문서 25건');
  const more = activity.getByRole('link', { name: '문서 15건 더 →' });
  await expect(more).toHaveCount(1);
  await more.click();
  // The rest of that commit is its own page, whose documents tab lists every document it changed.
  await expect(page).toHaveURL(new RegExp('/records/commits/'+ specs.head + '\\?tab=documents$'));
  const commitPage = page.getByRole('article', { name: '커밋 상세' });
  // Twenty come with the page and the rest with "more", each without its text.
  await expect(commitPage.getByRole('navigation', { name: '바뀐 문서' }).getByRole('listitem')).toHaveCount(20);
  await commitPage.getByRole('navigation', { name: '바뀐 문서' }).getByRole('button', { name: '문서 더 보기' }).click();
  await expect(commitPage.getByRole('navigation', { name: '바뀐 문서' }).getByRole('listitem')).toHaveCount(25);
  // One document is read at a time beside the list: the first, until another is chosen.
  await expect(commitPage.getByRole('region', { name: /도입 기록/ })).toHaveCount(1);
  await commitPage.getByRole('navigation', { name: '바뀐 문서' }).getByRole('link', { name: /도입 기록 24/ }).click();
  await expect(page).toHaveURL(/\?tab=documents#R-/);
  await expect(commitPage.getByRole('region', { name: '도입 기록 24' })).toBeVisible();
});

test('while history is still being counted the overview is not shown, so it never says zero or empty', async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/v1/history/summary', async route => { await pending; await route.fallback(); });
  await page.goto('/dashboard');
  // The dashboard is drawn only once its counts have answered; until then the rocket waits alone.
  await expect(page.getByRole('status', { name: '불러오는 중' })).toBeVisible();
  const article = page.getByRole('article', { name: '대시보드' });
  await expect(article).toHaveCount(0);
  release();
  await expect(article.getByLabel('최신 활동').getByRole('list', { name: '결정기록 목록' })).toBeVisible();
  await expect(article).toContainText('전체 활동 1건');
});
