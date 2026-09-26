import { expect, test } from '@playwright/test';
import { mockApi, serve, specs } from './mock-api';

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
  await mockApi(page); await page.goto('/dashboard');
  // The header button is the app's own signal that the page has mounted; a keystroke sent before that is lost.
  await expect(page.getByRole('button', { name: '문서 검색 열기' })).toBeVisible();
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

test('an instruction is found by its body and opens on enter', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  await ask(page, '중앙 컬럼');
  // The word is in the body, not the title; the row shows the title, the folder it lives in and the line it matched.
  const row = page.getByRole('option').filter({ hasText: '레이아웃 지침' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('layout');
  await expect(row).toContainText('중앙 컬럼');
  await expect(page.getByRole('dialog', palette)).toContainText('프로젝트 지침');
  // Nothing is highlighted yet, and enter still opens the first result.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/instructions\/I-bbbbbbbbbb$/);
  await expect(page.getByRole('dialog', palette)).toHaveCount(0);
});

test('a requirement opens its feature on the requirements tab', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  await ask(page, '검색어 입력');
  await expect(page.getByRole('dialog', palette)).toContainText('요구사항');
  await page.getByRole('option').filter({ hasText: '검색어 입력' }).first().click();
  await expect(page).toHaveURL(/\/features\/S-abcdefghij\?tab=requirements/);
  await expect(page.getByRole('tab', { name: '요구사항', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('a query that matches nothing shows the search state rather than an empty box', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
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
  await mockApi(page); await page.goto('/records');
  await page.getByRole('list', { name: '결정기록 목록' }).waitFor();
  await page.getByRole('textbox', { name: '검색', exact: true }).click();
  await page.keyboard.type('검색');
  // Straight after the keystrokes the query is not in the URL yet; it lands once typing stops.
  expect(page.url()).not.toContain('q=');
  await expect.poll(() => decodeURIComponent(page.url())).toContain('q=검색');
});

test('a record is found once by what it says and opens on its own page', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  await ask(page, '검색을 요청');
  const dialog = page.getByRole('dialog', palette);
  await expect(dialog).toContainText('결정기록');
  await expect(page.getByRole('option').filter({ hasText: '사용자가 검색을 요청했습니다.' })).toHaveCount(1);
  await page.getByRole('option').filter({ hasText: '사용자가 검색을 요청했습니다.' }).click();
  await expect(page).toHaveURL(/\/records\/H-aaaaaaaaaa$/);
});

test('a commit is found by its hash and opens its page', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  await ask(page, 'ccccccc');
  const dialog = page.getByRole('dialog', palette);
  await expect(dialog).toContainText('커밋');
  await page.getByRole('option').filter({ hasText: '검색 도입' }).click();
  await expect(page).toHaveURL(new RegExp('/records/commits/' + 'c'.repeat(40) + '$'));
});

test('each group shows five hits first and reads on in the palette when asked', async ({ page }) => {
  const data = structuredClone(specs);
  data.features[0]!.requirements = Array.from({ length: 8 }, (_, i) => ({ id: 'R-topic0000' + 'abcdefgh'[i], title: '주제 ' + (i + 1), body: '주제 본문' }));
  await mockApi(page); await serve(page, data); await page.goto('/dashboard');
  await ask(page, '주제');
  const dialog = page.getByRole('dialog', palette);
  await expect(page.getByRole('option').filter({ hasText: /^주제 \d/ })).toHaveCount(5);
  const more = page.getByRole('option').filter({ hasText: '3개 더 보기' });
  await expect(more).toBeVisible();
  await more.click();
  // The palette stays open with the same words, and the group now holds all eight.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveValue('주제');
  await expect(page.getByRole('option').filter({ hasText: /^주제 \d/ })).toHaveCount(8);
  await expect(page.getByRole('option').filter({ hasText: '더 보기' })).toHaveCount(0);
});

test('while a search is on its way the palette shows the loading rows, never an empty state', async ({ page }) => {
  await mockApi(page); await page.goto('/dashboard');
  // Hold the answer, so the moment between the keystroke and the results can be looked at.
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/search*', async route => { await held; await route.fallback(); });
  await ask(page, '검색어');
  const dialog = page.getByRole('dialog', palette);
  await expect(dialog.getByRole('status', { name: '문서를 읽는 중' })).toBeVisible();
  await expect(dialog).not.toContainText('검색할 문서가 없습니다.');
  await expect(dialog).not.toContainText('일치하는 문서가 없습니다.');
  release();
  await expect(page.getByRole('option').filter({ hasText: '검색어 입력' }).first()).toBeVisible();
});
