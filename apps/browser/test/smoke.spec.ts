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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('브리핑');
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('tryce 소개');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('tryce 소개');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('브리핑');
  expect(errors).toEqual([]);
});

test('unknown routes show an explicit missing page and a working return link', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다');
  await page.getByRole('link', { name: '처음으로' }).click();
  await expect(page).toHaveURL('/');
});
