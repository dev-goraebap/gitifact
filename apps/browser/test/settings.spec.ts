import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

const accent = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element).getPropertyValue('--color-accent').trim());
const surface = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element).getPropertyValue('--color-background-surface').trim());

test('settings is the last workspace menu and switches mode and palette for this browser only', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') requests.push(request.method() + ' ' + request.url()); });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '사이드 탐색' });
  const workspace = nav.getByRole('link');
  // Settings follows Git status inside the workspace group, before the Gitifact group.
  // allInnerTexts does not wait, so the menu has to be on screen first.
  await expect(nav.getByRole('link', { name: '설정', exact: true })).toBeVisible();
  const names = (await workspace.allInnerTexts()).map(name => name.trim());
  expect(names.indexOf('설정')).toBe(names.findIndex(name => name.startsWith('Git 상태')) + 1);
  expect(names.indexOf('설정')).toBeLessThan(names.indexOf('소개'));
  await nav.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('설정');

  const mode = page.getByRole('radiogroup', { name: '화면 모드' });
  await expect(mode.getByRole('radio', { name: '시스템' })).toBeChecked();
  const lightSurface = await surface(page);
  await mode.getByRole('radio', { name: '다크' }).click();
  await expect.poll(() => surface(page)).not.toBe(lightSurface);
  const darkSurface = await surface(page);
  await mode.getByRole('radio', { name: '라이트' }).click();
  await expect.poll(() => surface(page)).toBe(lightSurface);

  const palette = page.getByRole('region', { name: '색 조합' });
  const stoneAccent = await accent(page);
  const seen = new Set([stoneAccent]);
  for (const name of ['세이지 & 크림', '올리브 & 웜그레이', '슬레이트 & 블루', '샌드 & 클레이']) {
    // The card is the click target; its checkbox is visually hidden.
    await palette.getByText(name, { exact: true }).click();
    await expect.poll(() => accent(page)).not.toBe(stoneAccent);
    seen.add(await accent(page));
  }
  expect(seen.size).toBe(5);
  // The current palette cannot be switched off.
  await palette.getByText('샌드 & 클레이', { exact: true }).click();
  await expect(palette.getByRole('checkbox', { name: '샌드 & 클레이', exact: true })).toBeChecked();

  // The choice survives a reload and applies on every page, and nothing was sent to the server.
  await mode.getByRole('radio', { name: '다크' }).click();
  const clayDark = await accent(page);
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: '화면 모드' }).getByRole('radio', { name: '다크' })).toBeChecked();
  await expect(page.getByRole('region', { name: '색 조합' }).getByRole('checkbox', { name: '샌드 & 클레이', exact: true })).toBeChecked();
  expect(await accent(page)).toBe(clayDark);
  expect(await surface(page)).not.toBe(lightSurface);
  await page.goto('/about');
  expect(await accent(page)).toBe(clayDark);
  expect(await page.evaluate(() => window.localStorage.getItem('gitifact-appearance'))).toBe('{"mode":"dark","palette":"clay"}');
  expect(requests).toEqual([]);
  expect(darkSurface).not.toBe('');
});

test('a damaged stored preference falls back to the defaults', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('gitifact-appearance', '{"mode":"neon","palette":5}'));
  await page.goto('/settings');
  await expect(page.getByRole('radiogroup', { name: '화면 모드' }).getByRole('radio', { name: '시스템' })).toBeChecked();
  await expect(page.getByRole('region', { name: '색 조합' }).getByRole('checkbox', { name: '스톤', exact: true })).toBeChecked();
});
