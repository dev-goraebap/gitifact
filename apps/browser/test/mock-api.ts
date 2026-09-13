import type { Page } from '@playwright/test';
import { browserSessionV1, repositoryStatusSuccessV1, browserProjectV1 } from '@tryce/contracts';

export const session = browserSessionV1.parse({
  contract: 'browser-session',
  version: 1,
  sessionId: 'bb17c554-63a2-47f7-af46-2c3ac17952f1',
  repository: { key: 'repo:' + 'a'.repeat(64), worktreeKey: 'worktree:' + 'b'.repeat(64) },
});
export const status = repositoryStatusSuccessV1.parse({
  contract: 'repository-status',
  version: 1,
  ok: true,
  observation: {
    id: '93a9db7a-ef79-44ad-9566-a831c0b02be9',
    startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: '2026-09-13T00:00:01.000Z',
    consistency: 'best-effort',
  },
  repository: { ...session.repository, rootPath: '/fixture/project', objectFormat: 'sha1' },
  head: { state: 'branch', branch: 'main', commit: 'c'.repeat(40) },
  changes: [{ kind: 'tracked', path: 'partial.txt', xy: 'MM', submodule: null }],
  summary: { staged: 1, unstaged: 1, untracked: 0, conflicted: 0 },
  checks: { state: 'not-run', reason: 'git-status-only' },
});
export async function mockApi(page: Page) {
  await page.route('**/api/v1/session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/v1/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/v1/project', (route) => route.fulfill({ json: project }));
}

const revision = {
  id: 'rev-search',
  title: '검색 기능',
  text: '**검색어**를 입력하면 결과를 좁힙니다.',
  author: 'Fixture agent',
  reason: '테스트 자료',
  at: '2026-09-13T00:00:00Z',
};
export const project = browserProjectV1.parse({
  contract: 'browser-project',
  version: 1,
  brief: {
    contract: 'brief',
    version: 2,
    ok: true,
    report: {
      observation: status.observation,
      repository: status.repository,
      git: {
        head: status.head,
        summary: status.summary,
        changes: { total: 1, included: 1, omitted: 0, items: status.changes },
        source: 'head-index-working-tree',
      },
      project: { state: 'not-available', reason: '테스트 fixture' },
      requirements: {
        state: 'available',
        data: {
          total: 2,
          included: 2,
          omitted: 0,
          items: [
            {
              id: 'R-search-1',
              revision: 'rev-search',
              title: revision.title,
              state: 'active',
              approval: 'not-approved',
              path: '.tryce/spec/search/tryce.json',
              implementation: 'not-assessed',
              verification: 'not-run',
            },
            {
              id: 'R-export-2',
              revision: 'rev-export',
              title: '내보내기',
              state: 'draft',
              approval: 'not-approved',
              path: '.tryce/spec/export/tryce.json',
              implementation: 'not-assessed',
              verification: 'not-run',
            },
          ],
        },
      },
      notes: {
        state: 'available',
        data: {
          total: 1,
          included: 1,
          omitted: 0,
          items: [
            {
              kind: 'tryce-note',
              format: 'note-1',
              id: 'N-12345678-1234-4123-8123-123456789012',
              type: 'constraint',
              recordedAt: '2026-09-13T00:00:00Z',
              text: '로컬 기록만 읽습니다.',
              author: 'Fixture agent',
              references: [],
              supersedes: null,
              path: '.tryce/notes/example.json',
              textTruncated: false,
              correctedBy: [],
            },
          ],
        },
      },
      documents: { state: 'available', data: { total: 0, included: 0, omitted: 0, items: [] } },
      scope: { all: true, notes: 'working-tree', documents: 'root-AGENTS-README-and-docs-markdown' },
      checks: { state: 'not-run', reason: 'brief-is-observation-only' },
      unsupported: ['task-state', 'open-questions', 'history-analysis', 'skill-discovery'],
      followUp: {
        complete: 'tryce brief --all',
        notes: 'tryce note list',
        note: 'tryce note show <id>',
        git: 'tryce status',
      },
    },
  },
  requirements: {
    state: 'available',
    data: [
      {
        id: 'R-search-1',
        spec: 'search',
        path: '.tryce/spec/search/tryce.json',
        title: revision.title,
        text: revision.text,
        state: 'active',
        approval: 'not-approved',
        implementation: 'not-assessed',
        verification: 'not-run',
        revisions: [revision],
        reviews: [
          {
            id: 'review-search',
            at: revision.at,
            items: [
              {
                id: 'R-search-1',
                revision: revision.id,
                document: '# 검색 기능\n\n**검색어**를 입력하면 결과를 좁힙니다.',
                blob: 'fixture-blob',
              },
            ],
          },
        ],
        decisions: [
          {
            review: 'review-search',
            kind: 'auto',
            actor: 'Fixture agent',
            evidence: '자동 확정 테스트 자료',
            at: revision.at,
            mode: 'auto',
          },
        ],
      },
      {
        id: 'R-export-2',
        spec: 'export',
        path: '.tryce/spec/export/tryce.json',
        title: '내보내기',
        text: '내보내기 방식을 검토합니다.',
        state: 'draft',
        approval: 'not-approved',
        implementation: 'not-assessed',
        verification: 'not-run',
        revisions: [{ ...revision, id: 'rev-export', title: '내보내기' }],
        reviews: [],
        decisions: [],
      },
    ],
  },
});
