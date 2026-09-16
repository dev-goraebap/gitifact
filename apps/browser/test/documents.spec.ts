import { expect, test } from '@playwright/test';
import { mockApi, specs, status } from './mock-api';

test('guides browse as full-width columns, preview a chosen document and open its detail page from the preview', async ({ page }) => {
  await mockApi(page); await page.goto('/guides');
  // The guide browser has no page title, search box or view switch; the columns take the whole content area.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: '목록' })).toHaveCount(0);
  const browser = page.getByLabel('지침 문서 탐색');
  await expect(browser.getByText('frontend', { exact: true })).toBeVisible();
  await browser.getByText('이름 규칙', { exact: true }).click();
  await expect(page).toHaveURL(/\/guides\?selected=G-bbbbbbbbbb$/);
  const preview = page.getByLabel('문서 미리보기');
  await expect(preview).toContainText('소문자와 하이픈을 씁니다.');
  await browser.getByText('frontend', { exact: true }).click();
  await expect(page).toHaveURL(/\/guides\?folder=frontend$/);
  await expect(preview).toHaveCount(0);
  await browser.getByText('레이아웃 지침', { exact: true }).click();
  await expect(page).toHaveURL(/folder=frontend&selected=G-abcdefghij$/);
  await expect(preview).toContainText('중앙 컬럼은 64rem입니다.');
  await page.reload(); await expect(page.getByLabel('문서 미리보기')).toContainText('중앙 컬럼은 64rem입니다.');
  await page.getByRole('button', { name: '상세 보기' }).click();
  await expect(page).toHaveURL(/\/guides\/G-abcdefghij$/);
  const article = page.getByRole('article', { name: '지침 문서' });
  await expect(article).toContainText('중앙 컬럼은 64rem입니다.');
  await expect(page.getByText('미커밋 명세 변경이 있습니다', { exact: false })).toHaveCount(0);
  await article.getByRole('link', { name: '← 지침 / frontend' }).click();
  await expect(page).toHaveURL(/folder=frontend&selected=G-abcdefghij$/);
  await expect(page.getByLabel('문서 미리보기')).toContainText('중앙 컬럼은 64rem입니다.');
  await page.goto('/guides/G-missing000');
  await expect(page.getByRole('heading', { name: '문서를 찾을 수 없습니다' })).toBeVisible();
});

test('document changes appear in the activity feed with their kind and open the current document', async ({ page }) => {
  await mockApi(page);
  const event = specs.events[0]!;
  const data = { ...structuredClone(specs), events: [{ ...event, key: specs.head + ':G-abcdefghij', id: 'G-abcdefghij', kind: 'guide', types: ['modified'],
    before: { id: 'G-abcdefghij', title: '레이아웃 지침', body: '이전 본문', specId: 'guide', path: '.gitifact/guides/layout.md' },
    after: { id: 'G-abcdefghij', title: '레이아웃 지침', body: '중앙 컬럼은 64rem입니다.', specId: 'guide', path: '.gitifact/guides/frontend/layout.md' }, reasons: ['폴더를 정리했습니다.'] }] };
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: data }));
  await page.goto('/?document=guide');
  const rows = page.getByRole('list', { name: '활동 목록' }).getByRole('listitem'); await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('지침 문서');
  await rows.first().getByRole('link', { name: '레이아웃 지침' }).click();
  const pane = page.getByRole('dialog', { name: '레이아웃 지침' });
  await expect(pane).toContainText('지침 문서 변경');
  await pane.getByRole('link', { name: '현재 문서 보기 →' }).click();
  await expect(page).toHaveURL(/\/guides\/G-abcdefghij$/);
});

test('the product page is a dashboard of the loaded specs followed by PRODUCT.md without its banner image', async ({ page }) => {
  await mockApi(page);
  const data = structuredClone(specs);
  data.documents[0]!.body = '![GITIFACT](./gitifact-logo.svg)\n\n' + data.documents[0]!.body;
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: data }));
  await page.goto('/product');
  const article = page.getByRole('article', { name: '제품 개요' });
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('Gitifact');
  const summary = article.getByLabel('현재 명세 요약');
  await expect(summary).toContainText('기능 명세');
  await expect(summary).toContainText('지침 문서');
  await expect(article.getByLabel('기능별 요구사항 수')).toContainText('검색 기능');
  await expect(article.getByLabel('최근 변경 종류 범례').getByRole('listitem').first()).toHaveText('추가1 · 100%');
  await expect(article.getByLabel('참여자별 커밋 범례').getByRole('listitem').first()).toHaveText('Fixture3 · 75%');
  await expect(article.getByLabel('최근 명세 활동')).toContainText('검색어 입력');
  await expect(article.getByLabel('제품 설명')).toContainText('요구사항과 변경 이유를 Git에 연결합니다.');
  // The leading banner is dropped; every other relative image is served from the product folder.
  await expect(article.locator('img[alt="GITIFACT"]')).toHaveCount(0);
  await expect(article.locator('img[alt="로고"]')).toHaveAttribute('src', '/api/v1/product/assets/logo.png');
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  // The observed time moved into the header, left of the refresh button, without the read-only note.
  await expect(page.locator('header[aria-label="현재 위치"]')).toContainText('조회');
  await expect(page.getByText('로컬 읽기 전용', { exact: false })).toHaveCount(0);
  await page.getByRole('link', { name: '제품 개요 변경 이력 →' }).click();
  await expect(page).toHaveURL(/document=product/);
});

test('uncommitted spec changes mark the Git menu and are explained on the Git page instead of above the lists', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/specs*', r => r.fulfill({ json: { ...specs, working: true } }));
  await page.goto('/features');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('요구사항');
  await expect(page.getByText('작업 중인 내용이고', { exact: false })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '사이드 탐색' });
  await expect(nav.getByLabel('미커밋 명세 변경 있음')).toBeVisible();
  await nav.getByRole('link', { name: /^Git 상태/ }).click();
  await expect(page.getByText('요구사항·제품 개요·지침 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: '요구사항 보기 →' }).click();
  await expect(page).toHaveURL(/\/features$/);
});

test('a direct visit to the Git page reads uncommitted store paths from the repository status', async ({ page }) => {
  await mockApi(page);
  const data = { ...status, changes: [...status.changes, { kind: 'tracked', path: '.gitifact/spec/search/requirements.md', xy: '.M', submodule: null }], summary: { ...status.summary, unstaged: 2 } };
  await page.route('**/api/v1/status', r => r.fulfill({ json: data }));
  await page.goto('/git');
  await expect(page.getByText('요구사항·제품 개요·지침 화면은 작업 중인 내용이고', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '사이드 탐색' }).getByLabel('미커밋 명세 변경 있음')).toBeVisible();
});
