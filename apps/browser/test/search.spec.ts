import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

const palette = { name: '문서 검색' } as const;

/**
 * Opens the palette from the header button and types into its field once it is there. The shortcut is covered by its
 * own test; here the button is used because it can be waited for, while a keystroke sent before the page has mounted
 * its listener is simply lost.
 */
async function ask(page: import('@playwright/test').Page, query: string) {
  const trigger = page.getByRole('button', { name: '문서 검색 열기' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const field = page.getByRole('dialog', palette).getByRole('combobox');
  await expect(field).toBeVisible();
  await field.fill(query);
}

test('the palette opens from the shortcut and from the header, and closes with escape', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  await expect(page.getByRole('dialog', palette)).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', palette)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', palette)).toHaveCount(0);
  // The shortcut is printed on the button that opens the same dialog, so it is discoverable without the keyboard.
  const trigger = page.getByRole('button', { name: '문서 검색 열기' });
  await expect(trigger).toContainText('검색');
  await trigger.click();
  await expect(page.getByRole('dialog', palette)).toBeVisible();
  // Before anything is typed the palette offers the files touched most recently.
  await expect(page.getByRole('dialog', palette)).toContainText('최근 변경');
});

test('a wiki page is found by its body and opens on enter', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  await ask(page, '중앙 컬럼');
  // The word is in the page body, not its title; the row shows the title, where it lives and the line it matched.
  // The entry page links the same title, so it matches too; this is the page itself.
  const row = page.getByRole('option').filter({ hasText: 'frontend/layout.md' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('frontend/layout.md');
  await expect(row).toContainText('중앙 컬럼');
  await expect(page.getByRole('dialog', palette)).toContainText('위키 페이지');
  // Nothing is highlighted yet, and enter still opens the first result.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/wiki\/W-bbbbbbbbbb$/);
  await expect(page.getByRole('dialog', palette)).toHaveCount(0);
});

test('a requirement opens its feature on the requirements tab', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  await ask(page, '검색어 입력');
  await expect(page.getByRole('dialog', palette)).toContainText('요구사항');
  await page.getByRole('option').filter({ hasText: '검색어 입력' }).first().click();
  await expect(page).toHaveURL(/\/features\/S-abcdefghij\?tab=requirements/);
  await expect(page.getByRole('tab', { name: '요구사항', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('a query that matches nothing shows the search state rather than an empty box', async ({ page }) => {
  await mockApi(page); await page.goto('/product');
  await ask(page, '없는낱말');
  const dialog = page.getByRole('dialog', palette);
  await expect(dialog).toContainText('일치하는 문서가 없습니다.');
  await expect(dialog.locator('img[aria-hidden="true"]')).toBeVisible();
  // The dialog keeps one height whatever it holds, so the box does not resize on every keystroke.
  const withMessage = (await dialog.boundingBox())!.height;
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('option').first()).toBeVisible();
  expect(Math.round((await dialog.boundingBox())!.height)).toBe(Math.round(withMessage));
});

test('a search field waits for a pause in typing before it searches', async ({ page }) => {
  await mockApi(page); await page.goto('/activity');
  await page.getByRole('list', { name: '활동 목록' }).waitFor();
  await page.getByRole('textbox', { name: '검색', exact: true }).click();
  await page.keyboard.type('검색');
  // Straight after the keystrokes the query is not in the URL yet; it lands once typing stops.
  expect(page.url()).not.toContain('q=');
  await expect.poll(() => decodeURIComponent(page.url())).toContain('q=검색');
});
