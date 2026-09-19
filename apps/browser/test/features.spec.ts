import { expect, test, type Page } from '@playwright/test';
import { mockApi, specs, serve } from './mock-api';

// Three features so an order can be told apart from the store's own: they differ in design, contributor, requirement
// count and last change, and one carries a long description to prove the row keeps its height.
const many = structuredClone(specs);
many.features = [
  { ...specs.features[0]!, title: '검색 기능', updatedAt: '2026-09-14T00:00:00Z' },
  { id: 'S-bbbbbbbbbb', path: '.gitifact/spec/notify/requirements.md', title: '알림 기능',
    description: '변경이 생기면 알리고, 무엇이 어떻게 달라졌는지 그 자리에서 읽을 수 있게 한다. ' + '긴 설명은 한 줄로 잘린다. '.repeat(6),
    design: { title: '알림 설계', body: '알림은 서버가 밀지 않고 조회로 읽는다.', requirements: [], sources: [] },
    contributors: [{ name: 'Second', email: 'second@example.test', commits: 4, latest: '2026-09-16T00:00:00Z' }],
    updatedAt: '2026-09-16T00:00:00Z',
    requirements: [{ id: 'R-bbbbbbbbbb', title: '알림 표시', body: '알립니다.' }, { id: 'R-bbbbbbbbbc', title: '알림 끄기', body: '끕니다.' }, { id: 'R-bbbbbbbbbd', title: '알림 모아보기', body: '모읍니다.' }] },
  { id: 'S-cccccccccc', path: '.gitifact/spec/archive/requirements.md', title: '보관 기능', description: '',
    design: { title: '보관 설계', body: '보관은 삭제가 아니다.', requirements: [], sources: [] },
    contributors: [{ name: 'Fixture', email: 'fixture@example.test', commits: 1, latest: '2026-09-10T00:00:00Z' }],
    updatedAt: '2026-09-10T00:00:00Z',
    requirements: [{ id: 'R-cccccccccc', title: '보관하기', body: '보관합니다.' }, { id: 'R-ccccccccd', title: '되살리기', body: '되살립니다.' }] },
] as typeof specs.features;

async function listing(page: Page, url = '/features') {
  await mockApi(page);
  await serve(page, many);
  await page.goto(url);
  await expect(page.getByRole('table')).toBeVisible();
  return rowsOf(page);
}

// The body rows only: the header is a row too, and it is neither sorted nor sized like the entries.
const rowsOf = (page: Page) => page.locator('tbody tr');

async function choose(page: Page, filter: string, option: string) {
  await page.getByRole('combobox', { name: filter }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const titles = (rows: ReturnType<Page['locator']>) => rows.locator('a[href^="/features/S-"]').allInnerTexts();

test('the list opens on the most recently changed feature and can be reordered', async ({ page }) => {
  const rows = await listing(page);
  // Recent first by default: the store's own order says nothing about where the work is.
  expect(await titles(rows)).toEqual(['알림 기능', '검색 기능', '보관 기능']);
  await choose(page, '정렬', '요구사항 많은 순');
  expect(await titles(rows)).toEqual(['알림 기능', '보관 기능', '검색 기능']);
  await choose(page, '정렬', '이름순');
  expect(await titles(rows)).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  // The order survives a reload because it is in the address.
  await expect(page).toHaveURL(/sort=title/);
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  expect(await titles(rowsOf(page))).toEqual(['검색 기능', '보관 기능', '알림 기능']);
});

test('the list narrows by a missing design and by contributor, and says how many of the whole are left', async ({ page }) => {
  const rows = await listing(page);
  await choose(page, '설계 여부', '설계 없음');
  expect(await titles(rows)).toEqual(['검색 기능']);
  await expect(page.getByText('전체 3개 중')).toBeVisible();
  // The one feature without a design is marked as such beside its title, so the reason it matched is visible.
  await expect(rows.first()).toContainText('설계 없음');
  await choose(page, '설계 여부', '설계 전체');
  await choose(page, '참여자', 'Second');
  expect(await titles(rows)).toEqual(['알림 기능', '검색 기능']);
  // A filter that matches nothing explains itself rather than showing an empty table.
  await page.getByRole('textbox', { name: '검색', exact: true }).fill('없는기능');
  await expect(page.getByText('검색어나 필터를 바꿔 보세요.')).toBeVisible();
});

test('filters are kept when a feature is opened and closed', async ({ page }) => {
  await listing(page, '/features?sort=title&design=yes');
  await page.getByRole('link', { name: '보관 기능' }).click();
  await expect(page.getByRole('article', { name: '기능 명세' })).toContainText('보관 기능');
  await expect(page).toHaveURL(/sort=title/);
  await page.getByRole('link', { name: '← 기능별 요구사항' }).click();
  await expect(page).toHaveURL(/design=yes/);
  await expect(rowsOf(page)).toHaveCount(2);
  expect(await titles(rowsOf(page))).toEqual(['보관 기능', '알림 기능']);
});

test('every row is the same height however long its description is', async ({ page }) => {
  const rows = await listing(page);
  const heights = await rows.evaluateAll(list => list.map(row => Math.round(row.getBoundingClientRect().height)));
  expect(heights).toHaveLength(3);
  expect(new Set(heights).size).toBe(1);
  // The long description is cut to the row, not wrapped onto a second line.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
