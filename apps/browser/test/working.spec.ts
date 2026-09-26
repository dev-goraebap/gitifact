import { expect, test } from '@playwright/test';
import { mockApi, specs, stamps, working, workingBodies, type Fixture } from './mock-api';

const R2 = 'R-bbbbbbbbbb', R3 = 'R-cccccccccc';
/** One feature whose documents stand three ways against the last commit, and an instruction added since. */
const uncommitted: Fixture = {
  ...specs,
  working: true,
  features: [{ ...specs.features[0]!, requirements: [
    { ...specs.features[0]!.requirements[0]!, state: 'modified' },
    { id: R2, title: '새 요구사항', body: '작성자로서 원한다.', state: 'added' },
    { id: R3, title: '지울 요구사항', body: '지운다.', state: 'deleted' },
  ] }],
  instructions: [{ id: 'I-bbbbbbbbbb', name: 'layout', title: '레이아웃 지침', body: '폭.', state: 'added' }],
};

test.afterEach(() => { stamps.current = undefined; working.current = undefined; });

test('a document not committed as it is says so in the lists; a committed one says nothing', async ({ page }) => {
  await mockApi(page, uncommitted);
  await page.goto('/features');
  const table = page.getByRole('table');
  await expect(table.getByText('커밋 전: 변경')).toHaveCount(1);
  await expect(table.getByText('커밋 전: 추가')).toHaveCount(1);
  await expect(table.getByText('커밋 전: 삭제 예정')).toHaveCount(1);
  // The row carries its state, which draws the bar at its start, and a document to be deleted is struck through.
  await expect(table.locator('[data-state="deleted"]')).toHaveCount(1);
  const struck = await table.locator('[data-state="deleted"] [data-state-title]').evaluate(el => getComputedStyle(el).textDecorationLine);
  expect(struck).toContain('line-through');
  await expect(table.locator('[data-row="feature"][data-state]')).toHaveCount(0);
  await page.goto('/instructions');
  await expect(page.getByRole('list', { name: '작업별 지침' })).toContainText('커밋 전: 추가');
});

test('coming back to the tab after the project changed offers a refresh, which reads it again', async ({ page }) => {
  await mockApi(page);
  let reads = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/checkout') reads++; });
  await page.goto('/features');
  await expect(page.getByRole('table')).toBeVisible();
  const comeBack = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // The same stamp: nothing to say.
  await comeBack();
  await expect(page.getByText('새 변경이 있습니다')).toHaveCount(0);
  stamps.current = 'stamp-2';
  await comeBack();
  const notice = page.getByText('새 변경이 있습니다');
  await expect(notice).toBeVisible();
  const before = reads;
  stamps.current = undefined;
  await page.getByRole('button', { name: '새로고침' }).last().click();
  await expect.poll(() => reads).toBe(before + 1);
  await expect(notice).toHaveCount(0);
});

test('the records list starts with the uncommitted work, whose page lists its records and documents beside their differences', async ({ page }) => {
  await mockApi(page);
  working.current = {
    records: [{ id: 'DR-aaaaaaaaaa', title: '검색 범위 넓히기', docs: ['R-abcdefghij'], draft: false, sections: [{ key: 'context', body: '찾지 못한다는 요청.' }, { key: 'decision', body: '본문까지 찾는다.' }] }],
    changes: [{ id: 'R-abcdefghij', kind: 'requirement', title: '검색어 입력', path: '.gitifact/spec/search/requirements/r-abcdefghij.md', types: ['modified'] },
      { id: R2, kind: 'requirement', title: '정렬', path: '.gitifact/spec/search/requirements/sort.md', types: ['modified'] }],
    withoutRecord: [R2],
  };
  workingBodies['R-abcdefghij'] = {
    before: { id: 'R-abcdefghij', title: '검색어 입력', body: '제목에서 찾는다.', specId: 'S-abcdefghij', path: '.gitifact/spec/search/requirements/r-abcdefghij.md' },
    after: { id: 'R-abcdefghij', title: '검색어 입력', body: '본문에서도 찾는다.', specId: 'S-abcdefghij', path: '.gitifact/spec/search/requirements/r-abcdefghij.md' },
  };
  await page.goto('/records');
  const entry = page.getByRole('region', { name: '커밋 전' });
  await expect(entry).toContainText('결정기록 1건 · 바뀐 문서 2개');
  await expect(entry).toContainText('결정기록 없는 변경 1개');
  await entry.getByRole('link', { name: '커밋 전' }).click();
  await expect(page).toHaveURL(/\/records\/working$/);
  const article = page.getByRole('article', { name: '커밋 전' });
  await expect(article.getByRole('tab', { name: '결정기록 1' })).toHaveAttribute('aria-selected', 'true');
  await expect(article).toContainText('검색 범위 넓히기');
  await expect(article).toContainText('정렬');
  await article.getByRole('tab', { name: '문서 2' }).click();
  await expect(article).toContainText('본문에서도 찾는다');
  // A record not committed yet opens at the address a committed one has.
  await page.goto('/records/DR-aaaaaaaaaa');
  const record = page.getByRole('article', { name: '결정기록 상세' });
  await expect(record).toContainText('본문까지 찾는다.');
  await expect(record.getByRole('link', { name: '커밋 전' })).toBeVisible();
});

test('no uncommitted work leaves the records list as it was', async ({ page }) => {
  await mockApi(page);
  await page.goto('/records');
  await expect(page.getByText('검색어 입력', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '커밋 전' })).toHaveCount(0);
});
