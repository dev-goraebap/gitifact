import { expect, test } from '@playwright/test';
import { mockApi, specs } from './mock-api';

test('guides open as folder columns, switch to a list and restore the document from its URL', async ({ page }) => {
  await mockApi(page); await page.goto('/guides');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('지침');
  const browser = page.getByLabel('지침 문서 탐색');
  await expect(browser.getByText('frontend', { exact: true })).toBeVisible();
  await browser.getByText('이름 규칙', { exact: true }).click();
  await expect(page).toHaveURL(/\/guides\/G-bbbbbbbbbb$/);
  const article = page.getByRole('article', { name: '지침 문서' });
  await expect(article).toContainText('소문자와 하이픈을 씁니다.');
  await expect(page.getByText('미커밋 명세 변경이 있습니다', { exact: false })).toHaveCount(0);
  await article.getByRole('link', { name: '← 지침' }).click();
  await browser.getByText('frontend', { exact: true }).click();
  await expect(page).toHaveURL(/\/guides\?folder=frontend$/);
  await browser.getByText('레이아웃 지침', { exact: true }).click();
  await expect(article).toContainText('중앙 컬럼은 64rem입니다.');
  await page.reload(); await expect(page.getByRole('article', { name: '지침 문서' })).toContainText('중앙 컬럼은 64rem입니다.');
  await page.getByRole('link', { name: '← 지침 / frontend' }).click();
  await expect(page).toHaveURL(/folder=frontend/);
  await page.getByRole('radio', { name: '목록' }).click();
  await expect(page.getByRole('table')).toContainText('frontend');
  await expect(page.getByRole('table')).not.toContainText('레이아웃 지침');
  await page.getByRole('table').getByText('frontend', { exact: true }).click();
  await expect(page.getByRole('table')).toContainText('레이아웃 지침');
  await page.getByRole('textbox', { name: '검색', exact: true }).fill('이름');
  await expect(page.getByRole('table')).toContainText('naming.md');
  await expect(page.getByRole('table')).not.toContainText('레이아웃 지침');
  await page.getByRole('link', { name: '이름 규칙' }).click();
  await expect(page.getByRole('article', { name: '지침 문서' })).toContainText('소문자와 하이픈을 씁니다.');
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

test('the product description renders PRODUCT.md as one page with images served beside it', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  const article = page.getByRole('article', { name: '제품 개요' });
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('Gitifact');
  await expect(article).toContainText('요구사항과 변경 이유를 Git에 연결합니다.');
  await expect(article.locator('img')).toHaveAttribute('src', '/api/v1/product/assets/logo.png');
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '제품 개요 변경 이력 →' }).click();
  await expect(page).toHaveURL(/document=product/);
});
