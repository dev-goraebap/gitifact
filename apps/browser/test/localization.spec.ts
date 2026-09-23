import { expect, test } from '@playwright/test';
import { mockApi, changelog } from './mock-api';

test.use({ locale: 'en-US' });
test.beforeEach(async ({ page }) => { await mockApi(page); });

test('language switches live, persists, synchronizes tabs, and returns to browser default', async ({ page, context }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('radio', { name: '한국어', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('설정');
  await expect(page.getByRole('navigation').first().getByRole('link', { name: '기능별 요구사항', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: '라이트', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('설정');
  const second = await context.newPage(); await mockApi(second); await second.goto('/settings');
  await expect(second.getByRole('heading', { level: 1 })).toHaveText('설정');
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(second.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.getByRole('link', { name: 'Feature requirements', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Browser default', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  expect(await page.evaluate(() => localStorage.getItem('gitifact-language'))).toBe('system');
});

test('guides and release notes follow the display language', async ({ page }) => {
  const languages: string[] = [];
  await page.route('**/api/v1/changelog*', route => {
    const lang = new URL(route.request().url()).searchParams.get('lang')!;
    languages.push(lang);
    expect(route.request().headers()['accept-language']).toBe(lang);
    return route.fulfill({ json: { ...changelog, language: lang, entries: [{ ...changelog.entries[0]!, added: [lang === 'en' ? 'English release note' : '한국어 패치노트'] }] } });
  });
  await page.goto('/getting-started');
  await expect(page.getByRole('heading', { name: 'Install and set up' })).toBeVisible();
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.getByText('Why I built it', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Release notes', exact: true }).first().click();
  await expect(page.getByText('English release note', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: '한국어', exact: true }).click();
  await page.getByRole('link', { name: '패치노트', exact: true }).click();
  await expect(page.getByText('한국어 패치노트', { exact: true })).toBeVisible();
  expect(languages).toEqual(['en', 'ko']);
  await page.getByRole('link', { name: '시작하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설치와 도입' })).toBeVisible();
});

test('switching language preserves the current URL, filter, and project text', async ({ page }) => {
  await page.goto('/features/S-abcdefghij?tab=requirements#R-abcdefghij');
  await expect(page.getByRole('heading', { name: '검색어 입력', exact: true })).toBeVisible();
  const url = page.url();
  await page.evaluate(() => {
    localStorage.setItem('gitifact-language', 'ko');
    window.dispatchEvent(new StorageEvent('storage', { key: 'gitifact-language', newValue: 'ko' }));
  });
  await expect(page.getByRole('navigation').first().getByRole('link', { name: '기능별 요구사항', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '검색어 입력', exact: true })).toBeVisible();
  await expect(page.getByText('기대 동작: 결과를 보여줍니다.', { exact: false })).toBeVisible();
  expect(page.url()).toBe(url);
});

test.describe('unsupported browser language', () => {
  test.use({ locale: 'ja-JP' });
  test('falls back to English and tolerates unavailable preference storage', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await page.getByRole('radio', { name: '한국어', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('설정');
  });
});

