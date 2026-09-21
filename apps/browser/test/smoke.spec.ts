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

  // The browser opens on the product overview.
  await page.goto('/');
  await expect(page).toHaveURL(/\/product$/);
  // The overview leads with the project, not with the menu label; the breadcrumb keeps the location.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('project');
  await expect(page.locator('header[aria-label="현재 위치"]')).toContainText('제품 개요');
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
  // The shared intro links to GitHub; inside the browser the requirements link opens the matching page.
  const intro = page.getByRole('article', { name: 'Gitifact 소개' });
  await expect(intro.getByRole('img', { name: 'GITIFACT' })).toBeVisible();
  await expect(intro).not.toContainText('<p align');
  await expect(intro.getByRole('link', { name: '요구사항' })).toHaveAttribute('href', '/features');
  await expect(intro.getByRole('link', { name: '패치노트' })).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gitifact 소개');
  await page.goBack();
  // The overview leads with the project, not with the menu label; the breadcrumb keeps the location.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('project');
  await expect(page.locator('header[aria-label="현재 위치"]')).toContainText('제품 개요');
  expect(errors).toEqual([]);
});

test('activity links from before 0.5.0 carry their filters to the activity page', async ({ page }) => {
  await page.goto('/?document=design&q=검색');
  await expect(page).toHaveURL(/\/activity\?document=design&q=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('활동');
  await expect(page.getByRole('textbox', { name: '검색', exact: true })).toHaveValue('검색');
});

test('the search field keeps Korean text composed through an input method', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Input method events are driven through the Chrome DevTools Protocol.');
  await page.goto('/activity');
  const field = page.getByRole('textbox', { name: '검색', exact: true });
  await field.click();
  const cdp = await page.context().newCDPSession(page);
  // Each step is what a Korean IME reports while one syllable is composed and the next one begins.
  for (const [text, commit] of [['ㄱ', false], ['거', false], ['검', false], ['검', true], ['ㅅ', false], ['새', false], ['색', false], ['색', true]] as const) {
    await cdp.send(commit ? 'Input.insertText' : 'Input.imeSetComposition', commit ? { text } : { text, selectionStart: text.length, selectionEnd: text.length });
  }
  await expect(field).toHaveValue('검색');
  await expect(page).toHaveURL(/q=%EA%B2%80%EC%83%89/);
});

test('unknown routes show an explicit missing page and a working return link', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다');
  await page.getByRole('link', { name: '처음으로' }).click();
  await expect(page).toHaveURL(/\/product$/);
});

test('the wordmark, the menu and the version share one left edge', async ({ page }) => {
  await mockApi(page);
  await page.goto('/product');
  await expect(page.getByRole('link', { name: '기능별 요구사항' })).toBeVisible();
  const edges = await page.evaluate(() => {
    const left = (n: Element | null | undefined) => (n ? Math.round(n.getBoundingClientRect().left) : -1);
    const leaf = (root: ParentNode, text: string) => [...root.querySelectorAll('*')].find(n => n.children.length === 0 && n.textContent?.trim() === text);
    const mark = document.querySelector('.gitifact-wordmark')!;
    const item = [...document.querySelectorAll('a')].find(a => a.getAttribute('href') === '/features')!;
    const version = [...document.querySelectorAll('a,button')].find(n => /^v\d/.test(n.textContent!.trim()))!;
    return {
      // The wordmark is drawn by the link's ::before, so its own padding is where the image starts.
      logo: Math.round(mark.getBoundingClientRect().left + parseFloat(getComputedStyle(mark).paddingLeft)),
      section: left(leaf(document, 'WORKSPACE')),
      icon: left(item.querySelector('svg')),
      version: left(leaf(version, version.textContent!.trim())),
    };
  });
  expect(new Set(Object.values(edges)).size).toBe(1);
});


test('getting started follows the intro and keeps Korean guidance on reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/about');
  await expect(page.getByRole('link', { name: '시작하기', exact: true })).toBeVisible();
  const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(links.indexOf('/about')).toBeGreaterThanOrEqual(0);
  expect(links.indexOf('/getting-started')).toBe(links.indexOf('/about') + 1);
  await page.getByRole('article').getByRole('link', { name: 'CLI 안내' }).click();
  await expect(page).toHaveURL(/\/getting-started$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('시작하기');
  const article = page.getByRole('article', { name: '시작하기' });
  await expect(article).toContainText('npx gitifact@latest init');
  await expect(article).toContainText('프로젝트에 맞게 위키 구성하기');
  await expect(article).toContainText('npx gitifact spec commit');
  await page.reload();
  await expect(article).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  const link = page.getByRole('link', { name: '시작하기', exact: true });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/getting-started$/);
  expect(errors).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`getting started is readable on mobile in ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/getting-started');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('시작하기');
    await expect(page.getByRole('article')).toContainText('직접 명령 실행하기');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
