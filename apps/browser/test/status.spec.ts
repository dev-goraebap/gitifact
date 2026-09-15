import { expect, test } from '@playwright/test';
import { repositoryStatusSuccessV1, repositoryStatusFailureV1 } from '@gitifact/contracts';
import { mockApi, session, status } from './mock-api';

test('loading, successful refresh and failure retain the last observed data', async ({ page }) => {
  let releaseInitial!: () => void;
  const initial = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  let current = status;
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', async (route) => {
    await initial;
    await route.fulfill({ json: current });
  });
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let started!: () => void;
  const refreshStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let posts = 0;
  await page.route('**/api/v1/status/refresh', async (route) => {
    posts++;
    if (posts === 1) {
      started();
      await refreshGate;
      current = repositoryStatusSuccessV1.parse({
        ...status,
        observation: { ...status.observation, completedAt: '2026-09-13T00:00:02.000Z' },
        changes: [...status.changes, { kind: 'untracked', path: 'new.txt', xy: null, submodule: null }],
        summary: { ...status.summary, untracked: 1 },
      });
      await route.fulfill({ json: current });
    } else
      await route.fulfill({
        status: 503,
        json: repositoryStatusFailureV1.parse({
          contract: 'repository-status',
          version: 1,
          ok: false,
          error: { code: 'GIT_FAILED', message: 'Git 조회에 실패했습니다.' },
        }),
      });
  });
  await page.goto('/git');
  await expect(page.getByText('저장소 상태를 읽고 있습니다.', { exact: true })).toBeVisible();
  releaseInitial();
  await expect(page.getByRole('cell', { name: 'partial.txt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '상태 새로고침' }).click();
  await refreshStarted;
  await expect(page.getByRole('button', { name: '조회 중…' })).toBeDisabled();
  releaseRefresh();
  await expect(page.getByRole('cell', { name: 'new.txt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '상태 새로고침' }).click();
  await expect(page.getByRole('alert')).toContainText('Git 조회에 실패했습니다.');
  await expect(page.getByRole('alert')).toContainText('이전 조회 결과');
  await expect(page.getByRole('cell', { name: 'new.txt', exact: true })).toBeVisible();
  await expect(page.locator('time')).toHaveAttribute('datetime', '2026-09-13T00:00:02.000Z');
  expect(posts).toBe(2);
});

test('wrong worktree and incompatible contracts cannot be shown as current data', async ({ page }) => {
  await mockApi(page);
  let wrong = true;
  await page.route('**/api/v1/status', (route) =>
    route.fulfill({
      json: wrong
        ? { ...status, repository: { ...status.repository, worktreeKey: 'worktree:' + 'd'.repeat(64) } }
        : status,
    }),
  );
  await page.goto('/git');
  await expect(page.getByRole('alert')).toContainText('다른 checkout');
  await expect(page.getByRole('table')).toHaveCount(0);
  wrong = false;
  await page.getByRole('button', { name: '다시 연결' }).click();
  await expect(page.getByRole('cell', { name: 'partial.txt', exact: true })).toBeVisible();
  await page.route('**/api/v1/status/refresh', (route) => route.fulfill({ json: { ...status, version: 2 } }));
  await page.getByRole('button', { name: '상태 새로고침' }).click();
  await expect(page.getByRole('alert')).toContainText('지원하는 계약');
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('connection failure and empty result are distinct', async ({ page }) => {
  await page.route('**/api/v1/session', (route) => route.abort('failed'));
  await page.goto('/git');
  await expect(page.getByRole('alert')).toContainText('로컬 서버에 연결하지 못했습니다');
  await expect(page.getByRole('table')).toHaveCount(0);
  await mockApi(page);
  await page.route('**/api/v1/status', (route) =>
    route.fulfill({
      json: repositoryStatusSuccessV1.parse({
        ...status,
        changes: [],
        summary: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
      }),
    }),
  );
  await page.getByRole('button', { name: '다시 연결' }).click();
  await expect(page.getByRole('heading', { name: '변경된 파일이 없습니다' })).toBeVisible();
});
