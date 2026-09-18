import { expect, test } from '@playwright/test';
import { changelog, mockApi, session } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('the footer shows the running version and leads to the release notes timeline', async ({ page }) => {
  await page.goto('/');
  const version = page.getByRole('link', { name: 'v0.4.0', exact: true });
  await expect(version).toBeVisible();
  // Nothing newer is known, so no update affordance is offered.
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

test('a newer release offers a prompt for the agent and the npm command, without installing anything', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1')) requests.push(request.url()); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { ...session, update: { status: 'available', latestVersion: '0.4.1' } } }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'v0.4.0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '0.4.1 사용 가능' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '새 버전이 있습니다' })).toBeVisible();
  await expect(dialog).toContainText('현재 0.4.0 · 최신 0.4.1');
  await expect(dialog).toContainText('gitifact를 0.4.1 버전으로 업데이트해 주세요.');
  await expect(dialog).toContainText('gitifact update');
  await expect(dialog).toContainText('npm install -g gitifact@0.4.1');
  await expect(dialog).toContainText('npm 전역 설치용');
  // The close button sits inside the padded header, and copy buttons live in code block header bars, not over the code.
  // Measure after the opening animation settles; mid-animation the dialog is still scaling and positions drift by a pixel.
  await dialog.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
  const box = (await dialog.boundingBox())!; const close = (await dialog.getByRole('button', { name: /닫기|close/i }).first().boundingBox())!;
  const title = (await dialog.getByRole('heading', { name: '새 버전이 있습니다' }).boundingBox())!;
  expect(title.x).toBeGreaterThan(box.x + 8); expect(title.y).toBeGreaterThan(box.y + 4); expect(close.x + close.width).toBeLessThan(box.x + box.width - 4);
  for (const text of ['gitifact를 0.4.1 버전으로', 'npm install -g gitifact@0.4.1']) {
    const code = (await dialog.locator('code', { hasText: text }).boundingBox())!;
    for (const copy of await dialog.getByRole('button', { name: /복사|copy/i }).all()) {
      const b = (await copy.boundingBox())!;
      expect(b.y + b.height <= code.y || b.y >= code.y + code.height || b.x >= code.x + code.width || b.x + b.width <= code.x).toBe(true);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // The browser never talks to the registry itself.
  expect(requests).toEqual([]);
});

test('a pending check is re-read a bounded number of times and failures never look like the latest version', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/v1/session', route => { reads++; return route.fulfill({ json: { ...session, update: { status: reads < 3 ? 'checking' : 'available', latestVersion: reads < 3 ? null : '0.4.1' } } }); });
  await page.goto('/about');
  await expect(page.getByRole('button', { name: '0.4.1 사용 가능' })).toBeVisible({ timeout: 10_000 });
  for (const status of ['unavailable', 'disabled'] as const) {
    await page.route('**/api/v1/session', route => route.fulfill({ json: { ...session, update: { status, latestVersion: null } } }));
    await page.goto('/about');
    // The version footer sits in the side navigation. The intro on this page may itself mention the latest version.
    const nav = page.getByRole('navigation', { name: '사이드 탐색' });
    await expect(nav.getByRole('link', { name: 'v0.4.0', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /사용 가능/ })).toHaveCount(0);
    await expect(nav.getByText('최신 버전')).toHaveCount(0);
  }
  await page.route('**/api/v1/changelog*', route => route.fulfill({ json: { ...changelog, fallback: true } }));
  await page.goto('/changelog');
  await expect(page.getByText('이 언어의 패치노트가 없어 기본 언어로 보여 줍니다.')).toBeVisible();
});
