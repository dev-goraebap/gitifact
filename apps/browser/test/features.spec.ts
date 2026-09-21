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

// The feature rows only: the header is a row too, and the requirements under a feature are rows of their own.
const rowsOf = (page: Page) => page.locator('tbody tr[data-row=feature]');
const requirementsOf = (page: Page) => page.locator('tbody tr[data-row=requirement]');

async function choose(page: Page, filter: string, option: string) {
  await page.getByRole('combobox', { name: filter }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

// The order lives in the column headers, so ordering the list means pressing the one that holds the values.
const orderBy = (page: Page, column: string) => page.getByRole('button', { name: new RegExp('^' + column + ' 기준 정렬') }).click();

const titles = (rows: ReturnType<Page['locator']>) => rows.locator('a[href^="/features/S-"]').allInnerTexts();

test('the columns that hold comparable values order the list, and the header says which one does', async ({ page }) => {
  const rows = await listing(page);
  // Recent first by default: the store's own order says nothing about where the work is.
  expect(await titles(rows)).toEqual(['알림 기능', '검색 기능', '보관 기능']);
  await expect(page.getByRole('columnheader', { name: /최근 변경/ })).toHaveAttribute('aria-sort', 'descending');
  // A column opens the way it is normally read: most requirements first, names from the top.
  await orderBy(page, '요구사항');
  expect(await titles(rows)).toEqual(['알림 기능', '보관 기능', '검색 기능']);
  await orderBy(page, '요구사항');
  expect(await titles(rows)).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  await orderBy(page, '기능');
  expect(await titles(rows)).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  await expect(page.getByRole('columnheader', { name: /^기능/ })).toHaveAttribute('aria-sort', 'ascending');
  // Only the columns with something to compare offer it.
  await expect(page.getByRole('columnheader', { name: '참여자' }).getByRole('button')).toHaveCount(0);
  // The order survives a reload because it is in the address.
  await expect(page).toHaveURL(/sort=title/);
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  expect(await titles(rowsOf(page))).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  // The default order writes nothing to the address.
  await orderBy(page, '최근 변경');
  await expect(page).not.toHaveURL(/sort=/);
  expect(await titles(rows)).toEqual(['알림 기능', '검색 기능', '보관 기능']);
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

test('every feature row is the same height however long its description is', async ({ page }) => {
  const rows = await listing(page);
  const heights = await rows.evaluateAll(list => list.map(row => Math.round(row.getBoundingClientRect().height)));
  expect(heights).toHaveLength(3);
  expect(new Set(heights).size).toBe(1);
  // The long description is cut to the row, not wrapped onto a second line.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a requirement is a row under its feature and opens on its own section', async ({ page }) => {
  await listing(page);
  // Every requirement of every feature is listed, under the feature that holds it.
  await expect(requirementsOf(page)).toHaveCount(6);
  const notify = page.locator('tbody tr[data-row=feature]', { hasText: '알림 기능' });
  await expect(notify).toContainText('3');
  await page.getByRole('link', { name: '알림 끄기', exact: true }).click();
  // The address names the requirement twice: once for the page to mark it, once as the fragment to land on.
  await expect(page).toHaveURL(/selected=R-bbbbbbbbbc/);
  await expect(page).toHaveURL(/#R-bbbbbbbbbc$/);
  const section = page.locator('#R-bbbbbbbbbc');
  await expect(section).toHaveAttribute('aria-current', 'location');
  // The mark is on the words of its title, not a rule beside the block.
  await expect(section.locator('mark')).toHaveText('알림 끄기');
  await expect(page.locator('[aria-current=location] mark')).toHaveCount(1);
});

test('a fragment typed from outside lands on its section, and only that one is marked', async ({ page }) => {
  const long = structuredClone(many);
  long.features[1]!.requirements = long.features[1]!.requirements.map(r => ({ ...r, body: (r.body + ' 본문이 한 화면을 넘도록 길게 이어집니다.').repeat(40) }));
  await mockApi(page);
  await serve(page, long);
  await page.goto('/features/S-bbbbbbbbbb?selected=R-bbbbbbbbbd&tab=requirements#R-bbbbbbbbbd');
  const section = page.locator('#R-bbbbbbbbbd');
  await expect(section.locator('mark')).toHaveText('알림 모아보기');
  // Landing means the section is at the top of the reading area, not that the page merely drew it.
  await expect.poll(async () => Math.round((await section.boundingBox())!.y)).toBeLessThan(160);
  await expect(page.locator('mark')).toHaveCount(1);
});

test('a design section names its requirements, and each requirement links back to that section', async ({ page }) => {
  const linked = structuredClone(many);
  linked.features[1]!.design = { title: '알림 설계', requirements: [], sources: [],
    body: '## 개요\n서버가 밀지 않는다.\n\n## 표시 방식\n<!-- gitifact-ref: R-bbbbbbbbbb -->\n조회로 읽는다.\n\n## 끄기\n<!-- gitifact-ref: R-bbbbbbbbbc -->\n설정에 둔다.' };
  await mockApi(page);
  await serve(page, linked);
  await page.goto('/features/S-bbbbbbbbbb?tab=requirements');
  // The requirement the design explains carries the way there; the one it does not name carries nothing.
  await expect(page.locator('#R-bbbbbbbbbb').getByRole('link', { name: '이 요구사항의 설계 →' })).toHaveCount(1);
  await expect(page.locator('#R-bbbbbbbbbd').getByRole('link', { name: '이 요구사항의 설계 →' })).toHaveCount(0);
  await page.locator('#R-bbbbbbbbbc').getByRole('link', { name: '이 요구사항의 설계 →' }).click();
  await expect(page).toHaveURL(/tab=design/);
  // The design opens on the section that explains it, marked the same way the requirement was.
  await expect(page.getByRole('tabpanel', { name: '설계' }).locator('mark')).toHaveText('끄기');
  await expect(page.locator('mark')).toHaveCount(1);
  // The same link read the other way round is already there.
  await expect(page.getByRole('link', { name: 'R-bbbbbbbbbc' })).toHaveCount(1);
});

test('the list pages by feature so a feature is never split, and the page is kept in the address', async ({ page }) => {
  const wide = structuredClone(many);
  // Four features of fifteen requirements each: sixty-four rows, more than one page holds.
  wide.features = [0, 1, 2, 3].map(n => ({ ...many.features[1]!, id: 'S-' + 'abcdefghij'.slice(0, 9) + String(n), title: '기능 ' + n,
    updatedAt: '2026-09-' + (20 - n) + 'T00:00:00Z',
    requirements: Array.from({ length: 15 }, (_, i) => ({ id: 'R-' + n + 'bcdefghi' + String(i).padStart(2, '0'), title: `기능 ${n} 요구사항 ${i}`, body: '내용.' })) })) as typeof specs.features;
  await mockApi(page);
  await serve(page, wide);
  await page.goto('/features');
  // A feature shows twelve of its requirements and links on for the rest rather than filling the page.
  await expect(page.locator('tbody tr[data-row=feature]')).toHaveCount(2);
  await expect(page.locator('tbody tr[data-row=requirement]')).toHaveCount(24);
  await expect(page.getByRole('link', { name: '요구사항 3개 더 →' }).first()).toBeVisible();
  await page.getByRole('button', { name: '2 페이지로 이동' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('tbody tr[data-row=feature]')).toHaveCount(2);
  // Reloading the address shows the same page, and no feature was cut in half to fill the one before it.
  await page.reload();
  await expect(page.locator('tbody tr[data-row=feature]').first()).toContainText('기능 2');
  await expect(page.locator('tbody tr[data-row=requirement]')).toHaveCount(24);
});

test('a word finds the requirement that carries it, not only the feature it sits in', async ({ page }) => {
  await listing(page);
  await page.getByRole('textbox', { name: '검색', exact: true }).fill('되살리기');
  // The feature stays as the heading of its group, but only the requirement that matched is under it.
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(rowsOf(page)).toContainText('보관 기능');
  await expect(requirementsOf(page)).toHaveCount(1);
  await expect(requirementsOf(page)).toContainText('되살리기');
  // Naming the feature keeps all of them.
  await page.getByRole('textbox', { name: '검색', exact: true }).fill('보관 기능');
  await expect(requirementsOf(page)).toHaveCount(2);
});

test('the pager sits on the floor of the card even when the page is too short to scroll', async ({ page }) => {
  // Three long features fill the first page; a short fourth one lands on the second with room to spare.
  const wide = structuredClone(many);
  wide.features = [0, 1, 2, 3].map(n => ({ ...many.features[1]!, id: 'S-' + 'abcdefghij'.slice(0, 9) + String(n), title: '기능 ' + n,
    updatedAt: '2026-09-' + (20 - n) + 'T00:00:00Z',
    requirements: Array.from({ length: n === 3 ? 2 : 15 }, (_, i) => ({ id: 'R-' + n + 'bcdefghi' + String(i).padStart(2, '0'), title: `기능 ${n} 요구사항 ${i}`, body: '내용.' })) })) as typeof specs.features;
  await mockApi(page);
  await serve(page, wide);
  await page.setViewportSize({ width: 1440, height: 800 });
  const floor = () => page.evaluate(() => {
    const pager = document.querySelector('[class*=featurePager]')!.getBoundingClientRect();
    const card = [...document.querySelectorAll('*')].find(n => getComputedStyle(n).overflowY === 'auto' && n.scrollHeight > 0 && n.className.toString().includes('card'));
    return { gap: Math.round((card ? card.getBoundingClientRect().bottom : innerHeight) - pager.bottom), scrolls: !!card && card.scrollHeight > card.clientHeight + 4 };
  });
  // A full page scrolls, and the pager holds the floor rather than waiting at the end of the rows.
  await page.goto('/features');
  await expect(page.getByRole('button', { name: '2 페이지로 이동' })).toBeVisible();
  const full = await floor();
  expect(full.scrolls).toBe(true);
  expect(Math.abs(full.gap)).toBeLessThanOrEqual(8);
  // The last page is short enough that there is nothing to scroll, which is where sticky alone gave up: it used to
  // stop under the last row, a third of the way up the screen.
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto('/features?page=2');
  await expect(page.locator('tbody tr[data-row=feature]')).toHaveCount(2);
  const short = await floor();
  expect(short.scrolls).toBe(false);
  expect(Math.abs(short.gap)).toBeLessThanOrEqual(8);
});

for (const width of [1440, 760]) for (const colorScheme of ['light', 'dark'] as const) {
  test(`the page header stays pinned through a long feature list at ${width}px in ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme });
    const long = structuredClone(many);
    long.features = [...long.features, { ...long.features[0]!, id: 'S-dddddddddd' }].map((feature, n) => ({ ...feature,
      requirements: Array.from({ length: 12 }, (_, i) => ({ ...feature.requirements[0]!,
        id: 'R-' + 'abcd'[n]!.repeat(8) + 'abcdefghijkl'[i] + 'a', title: `요구사항 ${i}` })),
    }));
    await mockApi(page);
    await serve(page, long);
    await page.goto('/features');
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: '2 페이지로 이동' })).toBeVisible();
    const header = page.locator('header[aria-label]');
    const initial = (await header.boundingBox())!;
    const card = page.locator('[class*=card]').filter({ has: header });
    const range = await card.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(range).toBeGreaterThan(800);
    for (const fraction of [0.5, 1, 0]) {
      await card.evaluate((el, top) => { el.scrollTop = top; }, range * fraction);
      await expect.poll(async () => Math.abs((await header.boundingBox())!.y - initial.y)).toBeLessThanOrEqual(1);
      // It must remain above the table and filters, not just occupy the right coordinates.
      expect(await header.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
  });
}
