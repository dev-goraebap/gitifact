import { expect, test } from '@playwright/test';
import { mockApi, specs, status } from './mock-api';

test('the wiki is a repository-style explorer: a tree, the folder contents, and the page in the same pane', async ({ page }) => {
  await mockApi(page); await page.goto('/wiki');
  // No page title, search box or view switch; the tree and the pane take the whole content area.
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  const tree = page.getByRole('navigation', { name: '위키 트리' });
  const list = page.getByRole('list', { name: '폴더 내용' });
  await expect(tree.getByText('frontend', { exact: true })).toBeVisible();
  await expect(tree.getByText('README.md', { exact: true })).toBeVisible();
  // The root lists folders first, then files with their titles, and shows README.md below the list.
  await expect(list).toContainText('frontend'); await expect(list).toContainText('이름 규칙');
  await expect(page.getByRole('region', { name: 'Gitifact' })).toContainText('요구사항과 변경 이유를');
  // A folder opens in the pane and in the URL; its breadcrumb leads back.
  await list.getByText('frontend', { exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\?folder=frontend$/);
  await expect(list).toContainText('layout.md'); await expect(list).toContainText('레이아웃 지침');
  await expect(tree.getByText('layout.md', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('list', { name: '폴더 내용' })).toContainText('layout.md');
  // A file opens as the page itself; the tree stays and marks it.
  await page.getByRole('list', { name: '폴더 내용' }).getByText('layout.md', { exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/W-bbbbbbbbbb$/);
  const article = page.getByRole('article', { name: '위키 페이지' });
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('레이아웃 지침');
  await expect(article).toContainText('중앙 컬럼은 64rem입니다.');
  await expect(page.getByRole('navigation', { name: '위키 트리' }).getByText('layout.md', { exact: true })).toBeVisible();
  await expect(page.getByText('미커밋 명세 변경이 있습니다', { exact: false })).toHaveCount(0);
  await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: 'frontend' }).click();
  await expect(page).toHaveURL(/\/wiki\?folder=frontend$/);
  // The tree navigates on its own too.
  await page.getByRole('navigation', { name: '위키 트리' }).getByText('naming.md', { exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/W-cccccccccc$/);
  await expect(page.getByRole('article', { name: '위키 페이지' })).toContainText('소문자와 하이픈을 씁니다.');
  await page.goto('/wiki/W-missing0000');
  await expect(page.getByRole('heading', { name: '문서를 찾을 수 없습니다' })).toBeVisible();
  // The old guide routes are gone.
  await page.goto('/guides');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다');
});

test('a wiki that holds only its policy README opens straight onto it', async ({ page }) => {
  await mockApi(page);
  const policy = { id: 'W-pppppppppp', path: '.gitifact/wiki/README.md', title: '위키 운영 방침', body: '이 위키에는 아키텍처 결정 기록(ADR)을 쌓는다.', updatedAt: null };
  await page.route('**/api/v1/specs*', route => route.fulfill({ json: { ...structuredClone(specs), documents: [policy] } }));
  await page.goto('/wiki');
  // No one-row folder list: the policy itself is the page, and the URL stays on the wiki root.
  const article = page.getByRole('article', { name: '위키 페이지' });
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('위키 운영 방침');
  await expect(article).toContainText('아키텍처 결정 기록(ADR)을 쌓는다');
  await expect(page).toHaveURL(/\/wiki$/);
  await expect(page.getByRole('list', { name: '폴더 내용' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('README.md');
});

test('wiki changes appear in the activity feed with their kind and open the current page', async ({ page }) => {
  await mockApi(page);
  const event = specs.events[0]!;
  const data = { ...structuredClone(specs), events: [{ ...event, key: specs.head + ':W-bbbbbbbbbb', id: 'W-bbbbbbbbbb', kind: 'wiki', types: ['modified'],
    before: { id: 'W-bbbbbbbbbb', title: '레이아웃 지침', body: '이전 본문', specId: 'wiki', path: '.gitifact/wiki/layout.md' },
    after: { id: 'W-bbbbbbbbbb', title: '레이아웃 지침', body: '중앙 컬럼은 64rem입니다.', specId: 'wiki', path: '.gitifact/wiki/frontend/layout.md' }, reasons: ['폴더를 정리했습니다.'] }] };
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: data }));
  await page.goto('/activity?document=wiki');
  const rows = page.getByRole('list', { name: '활동 목록' }).getByRole('listitem'); await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('위키 페이지');
  await expect(rows.first()).toContainText('frontend/layout.md');
  await rows.first().getByRole('link', { name: '레이아웃 지침' }).click();
  const pane = page.getByRole('dialog', { name: '레이아웃 지침' });
  await expect(pane).toContainText('위키 페이지 변경');
  await pane.getByRole('link', { name: '현재 문서 보기 →' }).click();
  await expect(page).toHaveURL(/\/wiki\/W-bbbbbbbbbb$/);
});

test('the product page leads with what changed and why, and does not treat the wiki README as a product document', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  const article = page.getByRole('article', { name: '제품 개요' });
  // The project leads; the counts orient below it.
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('project');
  const summary = article.getByLabel('현재 명세 요약');
  await expect(summary).toContainText('기능 명세');
  await expect(summary).toContainText('위키 페이지');
  // The two loaded-range bars keep their legends above the reasons.
  await expect(article.getByLabel('최근 변경 종류 범례').getByRole('listitem').first()).toHaveText('추가1 · 100%');
  await expect(article.getByLabel('참여자별 커밋 범례').getByRole('listitem').first()).toHaveText('Fixture3 · 75%');
  // The recorded reason is the subject of the section below them, next to the record it explains.
  const reasons = article.getByLabel('최근 변경 이력');
  await expect(reasons).toContainText('사용자가 검색을 요청했습니다.');
  await expect(reasons).toContainText('검색어 입력');
  await reasons.getByRole('link', { name: '검색어 입력' }).click();
  await expect(page).toHaveURL(/\/activity\?selected=/);
  await page.goBack();
  // One way into the activity timeline, not two.
  await expect(article.getByRole('link', { name: '활동 →' })).toHaveCount(1);
  // The README is the wiki's policy: the dashboard neither shows it nor links to it as a product document.
  await expect(article).not.toContainText('요구사항과 변경 이유를 Git에 연결합니다.');
  await expect(article.getByRole('link', { name: '제품 문서 보기' })).toHaveCount(0);
  await expect(article).not.toContainText('W-abcdefghij');
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  await expect(page.locator('header[aria-label="현재 위치"]')).toContainText('조회');
  await expect(page.getByText('로컬 읽기 전용', { exact: false })).toHaveCount(0);
});

test('the wiki README reads like any page: banner dropped, store assets served, activity linked', async ({ page }) => {
  await mockApi(page);
  const data = structuredClone(specs);
  data.documents[0]!.body = '![GITIFACT](../assets/gitifact-logo.svg)\n\n' + data.documents[0]!.body;
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: data }));
  await page.goto('/wiki/W-abcdefghij');
  const reading = page.getByRole('article', { name: '위키 페이지' });
  await expect(reading.getByRole('heading', { level: 1 })).toHaveText('Gitifact');
  await expect(reading).toContainText('요구사항과 변경 이유를 Git에 연결합니다.');
  // The leading banner is dropped on the README; a store asset is served by the CLI's assets route.
  await expect(reading.locator('img[alt="GITIFACT"]')).toHaveCount(0);
  await expect(reading.locator('img[alt="로고"]')).toHaveAttribute('src', '/api/v1/assets/logo.png');
  expect(await reading.locator('.astryx-markdown-paragraph').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
  await page.reload();
  await expect(reading.getByRole('heading', { level: 1 })).toHaveText('Gitifact');
  await reading.getByRole('link', { name: '이 문서의 활동 →' }).click();
  await expect(page).toHaveURL(/document=wiki&q=W-abcdefghij/);
});

test('relative links in a page resolve to wiki pages, feature specs, assets, missing pages and files outside the browser', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockApi(page);
  await page.goto('/wiki/W-abcdefghij');
  const reading = page.getByRole('article', { name: '위키 페이지' });
  await expect(reading.getByRole('link', { name: '레이아웃 지침' })).toHaveAttribute('href', '/wiki/W-bbbbbbbbbb');
  await expect(reading.getByRole('link', { name: '검색 설계' })).toHaveAttribute('href', '/features/S-abcdefghij?tab=design');
  // A repository file the browser does not serve: no navigation, a hint on hover, the path copied on click.
  const outside = reading.getByRole('button', { name: '개발 환경' });
  await outside.hover();
  await expect(page.locator('.astryx-tooltip', { hasText: '브라우저 밖의 파일입니다' })).toBeVisible();
  await outside.click();
  await expect(page).toHaveURL(/\/wiki\/W-abcdefghij$/);
  await expect(page.getByRole('region', { name: '알림' }).getByText('경로를 복사했습니다')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('docs/development.md');
  // A page that does not exist is inert text that names the missing path on hover.
  await expect(reading.getByRole('link', { name: '없는 페이지' })).toHaveCount(0);
  await expect(reading.getByRole('button', { name: '없는 페이지' })).toHaveCount(0);
  await reading.getByText('없는 페이지', { exact: true }).hover();
  await expect(page.locator('.astryx-tooltip', { hasText: '페이지가 없습니다: .gitifact/wiki/missing.md' })).toBeVisible();
  await reading.getByRole('link', { name: '레이아웃 지침' }).click();
  await expect(page).toHaveURL(/\/wiki\/W-bbbbbbbbbb$/);
  await expect(page.getByRole('article', { name: '위키 페이지' })).toContainText('중앙 컬럼은 64rem입니다.');
});

test('uncommitted spec changes mark the Git menu and are explained on the Git page instead of above the lists', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: { ...specs, working: true } }));
  await page.goto('/features');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('기능별 요구사항');
  await expect(page.getByText('작업 중인 내용이고', { exact: false })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '사이드 탐색' });
  await expect(nav.getByLabel('미커밋 명세 변경 있음')).toBeVisible();
  await nav.getByRole('link', { name: /^Git 상태/ }).click();
  await expect(page.getByText('제품 개요·기능별 요구사항·위키 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: '요구사항 보기 →' }).click();
  await expect(page).toHaveURL(/\/features$/);
});

test('a direct visit to the Git page reads uncommitted store paths from the repository status', async ({ page }) => {
  await mockApi(page);
  const data = { ...status, changes: [...status.changes, { kind: 'tracked', path: '.gitifact/spec/search/requirements.md', xy: '.M', submodule: null }], summary: { ...status.summary, unstaged: 2 } };
  await page.route('**/api/v1/status', r => r.fulfill({ json: data }));
  await page.goto('/git');
  await expect(page.getByText('제품 개요·기능별 요구사항·위키 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '사이드 탐색' }).getByLabel('미커밋 명세 변경 있음')).toBeVisible();
});

test('the two overview charts share one height even when one legend wraps', async ({ page }) => {
  await mockApi(page);
  const many = structuredClone(specs);
  many.contributors = Array.from({ length: 7 }, (_, i) => ({ name: 'Person ' + i, email: `p${i}@example.test`, commits: 10 - i, latest: '2026-09-14T00:00:00Z' }));
  await page.route('**/api/v1/specs*', route => route.fulfill({ json: many }));
  await page.goto('/product');
  const card = (name: string) => page.getByRole('heading', { level: 3, name }).locator('xpath=ancestor::*[parent::*[contains(@class,"astryx-grid") or contains(@style,"grid")]][1]');
  await expect(page.getByRole('heading', { level: 3, name: '참여자별 커밋' })).toBeVisible();
  const heights = await Promise.all(['최근 변경 종류', '참여자별 커밋'].map(async name => Math.round((await card(name).boundingBox())!.height)));
  expect(heights[0]).toBe(heights[1]);
});

for (const [url, shape] of [['/wiki', 'folder'], ['/wiki/W-bbbbbbbbbb', 'page']] as const) {
  test(`a slow wiki shows the explorer's own shape while it loads (${shape})`, async ({ page }) => {
    await mockApi(page);
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/specs*', async route => { await held; await route.fulfill({ json: specs }); });
    await page.goto(url);
    const loading = page.getByRole('status', { name: '프로젝트 불러오는 중' });
    await expect(loading).toBeVisible();
    // The placeholder is laid out on the explorer: a tree column as wide as the real one, beside the pane.
    const tree = (await loading.locator(':scope > div').first().boundingBox())!;
    release();
    await expect(loading).toHaveCount(0);
    const real = (await page.getByRole('navigation', { name: '위키 트리' }).boundingBox())!;
    expect(Math.round(tree.x)).toBe(Math.round(real.x));
    expect(Math.round(tree.width)).toBe(Math.round(real.width));
  });
}
