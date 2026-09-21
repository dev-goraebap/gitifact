import { expect, test } from '@playwright/test';
import { changelog, mockApi, session } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('the footer shows the running version and leads to the release notes timeline', async ({ page }) => {
  await page.goto('/');
  const version = page.getByRole('link', { name: 'v0.4.0', exact: true });
  await expect(version).toBeVisible();
  // The footer only links to the bundled release notes.
  await expect(page.getByRole('button', { name: /사용 가능/ })).toHaveCount(0);
  await version.click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('패치노트');
  const releases = page.getByRole('region');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['0.4.0', '0.3.2']);
  const current = page.getByRole('region', { name: '0.4.0 변경 내역' });
  await expect(current.getByText('사용 중', { exact: true })).toBeVisible();
  await expect(current.getByText('추가', { exact: true })).toBeVisible();
  await expect(current.getByText('변경', { exact: true })).toBeVisible();
  await expect(current.getByText('제거', { exact: true })).toHaveCount(0);
  // Items are Markdown, so emphasis and code render instead of showing raw marks.
  await expect(current.locator('strong')).toHaveText('패치노트');
  await expect(current.locator('code')).toHaveText('update');
  const older = page.getByRole('region', { name: '0.3.2 변경 내역' });
  await expect(older.getByText('사용 중', { exact: true })).toHaveCount(0);
  await expect(older.getByText('제거', { exact: true })).toBeVisible();
  await expect(older.getByText('수정', { exact: true })).toBeVisible();
  await expect(releases).toHaveCount(2);
  // Reachable from the menu and on a direct visit.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('패치노트');
  await expect(page.getByRole('link', { name: '패치노트', exact: true })).toBeVisible();
});

test('the viewer has no update controls or session polling', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1')) external.push(request.url()); });
  let reads = 0;
  await page.route('**/api/v1/session', route => { reads++; return route.fulfill({ json: session }); });
  await page.clock.install();
  await page.goto('/about');
  const nav = page.getByRole('navigation', { name: '사이드 탐색' });
  await expect(nav.getByRole('link', { name: 'v0.4.0', exact: true })).toBeVisible();
  const settledReads = reads;
  await page.clock.fastForward(10_000);
  expect(reads).toBe(settledReads);
  await expect(nav.getByRole('button', { name: /사용 가능|업데이트/ })).toHaveCount(0);
  expect(external).toEqual([]);
});

test('missing release note language is reported', async ({ page }) => {
  await page.route('**/api/v1/changelog*', route => route.fulfill({ json: { ...changelog, fallback: true } }));
  await page.goto('/changelog');
  await expect(page.getByText('이 언어의 패치노트가 없어 기본 언어로 보여 줍니다.')).toBeVisible();
});
