import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('built app loads Astryx and supports navigation, reload, and history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('활동');
  const button = page.getByRole('link', { name: '소개', exact: true });
  await expect(button).toBeVisible();
  // Confirms that the shipped component CSS and theme have both loaded.
  expect(
    await button.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--color-text-primary').trim(),
    ),
  ).not.toBe('');
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gitifact 소개');
  // The shared intro links to GitHub; inside the browser these two open the matching pages.
  const intro = page.getByRole('article', { name: 'Gitifact 소개' });
  await expect(intro.getByRole('img', { name: 'GITIFACT' })).toBeVisible();
  await expect(intro).not.toContainText('<p align');
  await expect(intro.getByRole('link', { name: '아키텍처 안내' })).toHaveAttribute('href', '/wiki');
  await expect(intro.getByRole('link', { name: '요구사항' })).toHaveAttribute('href', '/features');
  await expect(intro.getByRole('link', { name: '개발 환경' })).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gitifact 소개');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('활동');
  expect(errors).toEqual([]);
});

test('unknown routes show an explicit missing page and a working return link', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다');
  await page.getByRole('link', { name: '처음으로' }).click();
  await expect(page).toHaveURL('/');
});
