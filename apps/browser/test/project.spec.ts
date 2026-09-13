import { expect, test } from '@playwright/test';
import { mockApi, project, session } from './mock-api';

test('requirements support URL filters, detail history and exact confirmed Markdown', async ({ page }) => {
  await mockApi(page);
  await page.goto('/requirements');
  await page.getByRole('textbox', { name: '요구사항 검색' }).fill('검색');
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole('link', { name: '내보내기', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '검색 기능', exact: true }).click();
  await expect(page).toHaveURL(/selected=R-search-1/);
  const detail = page.getByRole('complementary', { name: '요구사항 상세' });
  await expect(detail).toContainText('구현 미평가 · 검증 미실행');
  await expect(detail.locator('strong').first()).toHaveText('검색어');
  await detail.getByText('확인한 정확한 내용', { exact: true }).click();
  await expect(detail).toContainText('수정본 rev-search');
  await expect(detail).toContainText('자동 확정 · Fixture agent');
  await page.reload();
  await expect(detail).toBeVisible();
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '요구사항 검색' })).toHaveValue('검색');
  await page.getByRole('textbox', { name: '요구사항 검색' }).fill('no-result');
  await expect(page.getByText('검색 조건에 맞는 요구사항이 없습니다.')).toBeVisible();
});

test('failed reload retains labelled prior data; a different worktree requires reconnection', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/requirements');
  await expect(page.getByRole('link', { name: '검색 기능', exact: true })).toBeVisible();
  await page.route('**/api/v1/project', (route) => route.abort());
  await page.getByRole('button', { name: '새로 읽기' }).click();
  await expect(page.getByRole('alert')).toContainText('이전 조회 결과');
  await expect(page.getByRole('link', { name: '검색 기능', exact: true })).toBeVisible();
  const wrong = structuredClone(project);
  wrong.brief.report!.repository.worktreeKey = 'worktree:' + 'd'.repeat(64);
  await page.route('**/api/v1/project', (route) => route.fulfill({ json: wrong }));
  await page.getByRole('button', { name: '새로 읽기' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 checkout');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.route('**/api/v1/project', (route) => route.fulfill({ json: project }));
  await page.getByRole('button', { name: '다시 연결' }).click();
  await expect(page.getByRole('link', { name: '검색 기능', exact: true })).toBeVisible();
});

test('mobile navigation, dark theme and untrusted Markdown remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const unsafe = structuredClone(project);
  if (unsafe.requirements.state === 'available')
    unsafe.requirements.data[0]!.text =
      '<script>window.bad = true</script>\n\n[bad](javascript:alert(1))\n\n**읽을 내용**';
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/project', (route) => route.fulfill({ json: unsafe }));
  await page.goto('/requirements?selected=R-search-1');
  const detail = page.getByRole('complementary', { name: '요구사항 상세' });
  await expect(detail).toContainText('읽을 내용');
  await expect(detail).toBeInViewport();
  await expect(detail.locator('script, a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await detail.getByRole('button', { name: '상세 닫기' }).click();
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole('link', { name: '검색 기능', exact: true })).toBeFocused();
  const toggle = page.getByRole('button', { name: '탐색 열기', exact: true });
  await toggle.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: '판단 기록', exact: true }).click();
  await expect(page).toHaveURL(/\/decisions/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('로컬 기록만 읽습니다.')).toBeVisible();
});
