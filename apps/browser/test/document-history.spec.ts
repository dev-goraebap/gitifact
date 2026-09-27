import { expect, test } from '@playwright/test';
import { mockApi, specs } from './mock-api';

// A requirement changed three times: added with a reason, edited with no record, then edited with a decision record.
function historyOf() {
  const data = structuredClone(specs); const base = data.events[0]!;
  const commit = (n: string) => 'e'.repeat(38) + n;
  const edit = (n: string, date: string, message: string, records: typeof base.records) =>
    ({ ...base, key: commit(n) + ':' + base.id, commit: commit(n), date, message, types: ['modified' as const], before: base.after, records });
  data.events = [
    edit('02', '2026-09-16T00:00:00Z', '검색어 길이 제한', [{ id: 'DR-aaaaaaaaaa', title: '검색어 200자 제한', sections: [
      { key: 'context', body: '긴 검색어로 서버가 느려졌다.' }, { key: 'decision', body: '검색어는 200자까지 받는다.' }, { key: 'alternatives', body: '- 제한 없음(느려짐)' }] }]),
    edit('01', '2026-09-15T00:00:00Z', '문구 정리', []),
    base,
  ];
  return { data, base, commit };
}

test('a document history lists every commit that changed it, opens a record in place, and marks a change no record explains', async ({ page }) => {
  const { data, base, commit } = historyOf();
  await mockApi(page, data);
  await page.goto('/records/docs/' + base.id);
  const article = page.getByRole('article', { name: '문서 변경 이력' });
  await expect(article.getByRole('heading', { level: 1 })).toHaveText('검색어 입력');
  await expect(article).toContainText('커밋 3개 · 결정기록이 붙은 커밋 2개 · 결정기록 없이 바뀐 커밋 1개');
  const commits = article.getByRole('list', { name: '이 문서를 바꾼 커밋' }).locator(':scope > li');
  await expect(commits).toHaveCount(3);
  await expect(commits.nth(0)).toContainText('검색어 200자 제한');
  await expect(commits.nth(1).getByText('결정기록 없이 바뀜')).toBeVisible();
  await expect(commits.nth(2)).not.toContainText('결정기록 없이 바뀜');
  // Closed, a record shows the first line of its decision; opened, every section in full.
  await expect(commits.nth(0)).toContainText('검색어는 200자까지 받는다.');
  await expect(page.getByText('긴 검색어로 서버가 느려졌다.')).toBeHidden();
  await commits.nth(0).getByRole('button', { name: '맥락·대안 펼치기' }).click();
  await expect(page.getByText('긴 검색어로 서버가 느려졌다.')).toBeVisible();
  await expect(page.getByText('제한 없음(느려짐)')).toBeVisible();
  await commits.nth(0).getByRole('button', { name: '접기' }).click();
  await expect(page.getByText('긴 검색어로 서버가 느려졌다.')).toBeHidden();
  // The document now, and each change on its commit page.
  await expect(article.getByRole('link', { name: '지금 문서 보기' })).toHaveAttribute('href', /\/features\/S-abcdefghij\?.*selected=R-abcdefghij/);
  await commits.nth(0).getByRole('link', { name: '변경 비교 →' }).click();
  await expect(page).toHaveURL(new RegExp('/records/commits/' + commit('02') + '[?]tab=documents#' + base.id + '$'));
  // The commit page's document history link comes back here.
  await page.getByRole('link', { name: '이 문서의 변경 이력 →' }).first().click();
  await expect(page).toHaveURL(new RegExp('/records/docs/' + base.id + '$'));
});

test('a document neither the working tree nor the history has says so', async ({ page }) => {
  await mockApi(page, historyOf().data);
  await page.goto('/records/docs/R-zzzzzzzzzz');
  await expect(page.getByText('문서를 찾을 수 없습니다')).toBeVisible();
});
