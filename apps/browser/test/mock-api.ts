import type { Page } from '@playwright/test';
import { browserSessionV1, repositoryStatusSuccessV1 } from '@tryce/contracts';

export const session = browserSessionV1.parse({
  contract: 'browser-session', version: 1, sessionId: 'bb17c554-63a2-47f7-af46-2c3ac17952f1',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
});
export const status = repositoryStatusSuccessV1.parse({
  contract: 'repository-status', version: 1, ok: true,
  observation: { id: '93a9db7a-ef79-44ad-9566-a831c0b02be9', startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: '2026-09-13T00:00:01.000Z', consistency: 'best-effort' },
  repository: { ...session.repository, rootPath: '/fixture/project', objectFormat: 'sha1' },
  head: { state: 'branch', branch: 'main', commit: 'c'.repeat(40) },
  changes: [{ kind: 'tracked', path: 'partial.txt', xy: 'MM', submodule: null }],
  summary: { staged: 1, unstaged: 1, untracked: 0, conflicted: 0 },
  checks: { state: 'not-run', reason: 'git-status-only' },
});
export async function mockApi(page: Page) {
  await page.route('**/api/v1/session', route => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', route => route.fulfill({ json: status }));
}
