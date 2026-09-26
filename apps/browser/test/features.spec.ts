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

// The feature's own title link; the row's link to its designs points at the design tab.
const titles = (rows: ReturnType<Page['locator']>) => rows.locator('a[href^="/features/S-"]:not([href*="tab=design"])').allInnerTexts();

test('the list appears once and whole: one loader covers the frame and the rows until both have answered', async ({ page }) => {
  await mockApi(page);
  await serve(page, many);
  let releaseFrame!: () => void; let releaseRows!: () => void; let asked = 0;
  const frame = new Promise<void>(resolve => { releaseFrame = resolve; });
  const rows = new Promise<void>(resolve => { releaseRows = resolve; });
  await page.route(url => url.pathname === '/api/v1/checkout', async route => { await frame; await route.fallback(); });
  await page.route(url => url.pathname === '/api/v1/features', async route => { asked++; await rows; await route.fallback(); });
  await page.goto('/features');
  const loader = page.getByRole('status', { name: '불러오는 중' });
  const content = page.locator('[data-scroll-restoration-id="content"]');
  await expect(loader).toBeVisible();
  releaseFrame();
  // The frame has answered and the rows are asked for: the same loader stays, with no second placeholder under the filters.
  await expect.poll(() => asked).toBe(1);
  await expect(loader).toBeVisible();
  await expect(page.getByRole('status', { name: '프로젝트 불러오는 중' })).toHaveCount(0);
  await expect(content).toHaveAttribute('aria-busy', 'true');
  releaseRows();
  await expect(loader).toHaveCount(0);
  await expect(content).toHaveAttribute('aria-busy', 'false');
  await expect(content.locator('> *').first()).toHaveCSS('opacity', '1');
  await expect(rowsOf(page)).toHaveCount(3);
});

test('the columns that hold comparable values order the list, and the header says which one does', async ({ page }) => {
  const rows = await listing(page);
  // Recent first by default: the store's own order says nothing about where the work is.
  await expect.poll(() => titles(rows)).toEqual(['알림 기능', '검색 기능', '보관 기능']);
  await expect(page.getByRole('columnheader', { name: /최근 변경/ })).toHaveAttribute('aria-sort', 'descending');
  // A column opens the way it is normally read: most requirements first, names from the top.
  await orderBy(page, '요구사항');
  await expect.poll(() => titles(rows)).toEqual(['알림 기능', '보관 기능', '검색 기능']);
  await orderBy(page, '요구사항');
  await expect.poll(() => titles(rows)).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  await orderBy(page, '기능');
  await expect.poll(() => titles(rows)).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  await expect(page.getByRole('columnheader', { name: /^기능/ })).toHaveAttribute('aria-sort', 'ascending');
  // Only the columns with something to compare offer it.
  await expect(page.getByRole('columnheader', { name: '참여자' }).getByRole('button')).toHaveCount(0);
  // The order survives a reload because it is in the address.
  await expect(page).toHaveURL(/sort=title/);
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect.poll(() => titles(rowsOf(page))).toEqual(['검색 기능', '보관 기능', '알림 기능']);
  // The default order writes nothing to the address.
  await orderBy(page, '최근 변경');
  await expect(page).not.toHaveURL(/sort=/);
  await expect.poll(() => titles(rows)).toEqual(['알림 기능', '검색 기능', '보관 기능']);
});

test('a feature links its designs once, and a requirement row reads its description, criteria and a missing design', async ({ page }) => {
  const covered = structuredClone(many);
  const notify = covered.features[1]! as unknown as { design?: unknown; designs: unknown[]; requirements: { id: string; title: string; body: string; description?: string }[] };
  delete notify.design;
  notify.designs = [{ title: '알림 설계', body: '알림은 조회로 읽는다.', requirements: ['R-bbbbbbbbbb', 'R-bbbbbbbbbc'], sources: [] }, { title: '표시 방식', body: '목록.', requirements: ['R-bbbbbbbbbb'], sources: [] }];
  notify.requirements[0] = { id: 'R-bbbbbbbbbb', title: '알림 표시', description: '변경이 생기면 목록 위에 알린다',
    body: '사용자로서 알림을 보고 싶다.\n\n### 수용 조건\n\n1. 조건: 변경이 생깁니다.\n   기대 동작: 알립니다.\n2. 조건: 알림을 엽니다.\n   기대 동작: 변경을 보입니다.\n\n### 범위와 제약\n\n1. 목록만 다룬다.' };
  await mockApi(page);
  await serve(page, covered);
  await page.goto('/features');
  const feature = rowsOf(page).filter({ hasText: '알림 기능' });
  // One link to the feature's designs, with how many there are; the requirement rows carry none.
  await expect(feature.getByRole('link', { name: '설계 2 →' })).toHaveAttribute('href', /\/features\/S-bbbbbbbbbb\?.*tab=design/);
  await expect(requirementsOf(page).getByRole('link', { name: /설계/ })).toHaveCount(0);
  // Title over description, within the height one line took.
  const [title, description] = await Promise.all([feature.getByRole('link', { name: '알림 기능' }).boundingBox(), feature.getByText(/^변경이 생기면 알리고/).boundingBox()]);
  expect(description!.y).toBeGreaterThan(title!.y + title!.height - 1);
  expect((await feature.boundingBox())!.height).toBeLessThanOrEqual(65);
  const shown = requirementsOf(page).filter({ hasText: '알림 표시' });
  await expect(shown).toContainText('변경이 생기면 목록 위에 알린다');
  // Only the numbered items under the acceptance heading count, not those of the next section.
  await expect(shown).toContainText('수용 조건 2');
  // A requirement no design names is flagged; one a design names is not.
  await expect(requirementsOf(page).filter({ hasText: '알림 모아보기' })).toContainText('설계 없음');
  await expect(shown).not.toContainText('설계 없음');
});

test('the list narrows by a missing design and by contributor, and says how many of the whole are left', async ({ page }) => {
  const rows = await listing(page);
  await choose(page, '설계 여부', '설계 없음');
  await expect.poll(() => titles(rows)).toEqual(['검색 기능']);
  await expect(page.getByText('전체 3개 중')).toBeVisible();
  // The one feature without a design is marked as such beside its title, so the reason it matched is visible.
  await expect(rows.first()).toContainText('설계 없음');
  await choose(page, '설계 여부', '설계 전체');
  await choose(page, '참여자', 'Second');
  await expect.poll(() => titles(rows)).toEqual(['알림 기능', '검색 기능']);
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
  await expect.poll(() => titles(rowsOf(page))).toEqual(['보관 기능', '알림 기능']);
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
  // Every title carries the highlighter; the section the link named is the one on hatching.
  await expect(section.locator('mark')).toHaveText('알림 끄기');
  await expect(page.locator('[aria-current=location]')).toHaveCount(1);
  await expect(page.locator('#R-bbbbbbbbbb mark')).toHaveText('알림 표시');
  await expect(section).toHaveCSS('background-image', /repeating-linear-gradient/);
  await expect(page.locator('#R-bbbbbbbbbb')).toHaveCSS('background-image', 'none');
});

test('a fragment typed from outside lands on its section, and only that one lies on hatching', async ({ page }) => {
  const long = structuredClone(many);
  long.features[1]!.requirements = long.features[1]!.requirements.map(r => ({ ...r, body: (r.body + ' 본문이 한 화면을 넘도록 길게 이어집니다.').repeat(40) }));
  await mockApi(page);
  await serve(page, long);
  await page.goto('/features/S-bbbbbbbbbb?selected=R-bbbbbbbbbd&tab=requirements#R-bbbbbbbbbd');
  const section = page.locator('#R-bbbbbbbbbd');
  await expect(section.locator('mark')).toHaveText('알림 모아보기');
  // Landing means the section is at the top of the reading area, not that the page merely drew it.
  await expect.poll(async () => Math.round((await section.boundingBox())!.y)).toBeLessThan(160);
  await expect(page.locator('[aria-current=location]')).toHaveCount(1);
});

test('the design tab reads every design in order, each with its number, ID and history, and each requirement links to every design that names it', async ({ page }) => {
  const linked = structuredClone(many);
  linked.features[1]!.design = undefined;
  linked.features[1]!.designs = [{ title: '알림 설계', requirements: [], sources: [], body: '서버가 밀지 않는다.' },
    { title: '표시 방식', requirements: ['R-bbbbbbbbbb', 'R-bbbbbbbbbc'], sources: [], body: '조회로 읽는다.' },
    { title: '끄기', requirements: ['R-bbbbbbbbbc'], sources: [], body: '설정에 둔다.' }];
  const [shown, off] = ['D-bbbbbbbbb1', 'D-bbbbbbbbb2'];
  await mockApi(page);
  await serve(page, linked);
  await page.goto('/features/S-bbbbbbbbbb?tab=requirements');
  // A requirement names every design that explains it, by title; one no design names carries nothing.
  const designsOf = (id: string) => page.locator('#' + id).getByRole('link').filter({ hasNotText: '이력' });
  await expect(designsOf('R-bbbbbbbbbc')).toHaveText(['표시 방식', '끄기']);
  await expect(designsOf('R-bbbbbbbbbb')).toHaveText(['표시 방식']);
  await expect(page.locator('#R-bbbbbbbbbd').getByText('이 요구사항의 설계')).toHaveCount(0);
  await designsOf('R-bbbbbbbbbc').filter({ hasText: '끄기' }).click();
  await expect(page).toHaveURL(new RegExp('tab=design.*selected=' + off + '|selected=' + off + '.*tab=design'));
  // Every design is on the page in order, like the requirements; the one the link named is the section marked.
  const panel = page.getByRole('tabpanel', { name: '설계' });
  await expect(panel.locator('mark')).toHaveText(['알림 설계', '표시 방식', '끄기']);
  await expect(page).toHaveURL(new RegExp('#' + off + '$'));
  await expect(panel.locator('[aria-current=location]')).toHaveCount(1);
  await expect(page.locator('#' + off)).toHaveAttribute('aria-current', 'location');
  // Above each title, its number in the feature and its ID.
  await expect(page.locator('#' + off)).toContainText(new RegExp('설계 03\\s*·\\s*' + off));
  const index = page.getByRole('navigation', { name: '설계 목차' });
  await expect(index.getByRole('link')).toHaveText(['01　알림 설계', '02　표시 방식', '03　끄기']);
  // Both designs that explain "알림 끄기" list it under their prose.
  await expect(panel.getByRole('link', { name: '알림 끄기' })).toHaveCount(2);
  // Under the prose, each design has its history as one link into the activity, narrowed to that design.
  const historyOf = (id: string) => page.locator('#' + id).getByRole('region', { name: '변경 이력' }).getByRole('link', { name: '이 설계의 이력 →' });
  await expect(historyOf(off)).toHaveAttribute('href', new RegExp('q=' + off));
  await expect(historyOf(shown)).toHaveAttribute('href', new RegExp('q=' + shown));
  // The index moves between them on the same page.
  await index.getByRole('link', { name: '02　표시 방식' }).click();
  await expect(page).toHaveURL(new RegExp('#' + shown + '$'));
  // Opened without a choice, nothing is marked.
  await page.goto('/features/S-bbbbbbbbbb?tab=design');
  await expect(panel.locator('mark')).toHaveText(['알림 설계', '표시 방식', '끄기']);
  await expect(panel.locator('[aria-current=location]')).toHaveCount(0);
});

test('the list reads twenty whole features at a time and reads on, a long feature showing its first twelve', async ({ page }) => {
  const wide = structuredClone(many);
  // Twenty-two features, the first of fifteen requirements: the server sends twenty and says where the rest start.
  wide.features = Array.from({ length: 22 }, (_, n) => ({ ...many.features[1]!, id: 'S-' + 'abcdefgh' + 'abcdefghijklmnopqrstuvwxyz'[n]! + 'a', title: '기능 ' + String(n).padStart(2, '0'),
    updatedAt: '2026-09-' + String(28 - n).padStart(2, '0') + 'T00:00:00Z',
    requirements: Array.from({ length: n ? 1 : 15 }, (_, i) => ({ id: 'R-' + 'abcdefghijklmnopqrstuvwxyz'[n]! + 'bcdefgh' + String(i).padStart(2, '0'), title: `기능 ${n} 요구사항 ${i}`, body: '내용.' })) })) as typeof specs.features;
  await mockApi(page);
  await serve(page, wide);
  await page.goto('/features');
  await expect(page.locator('tbody tr[data-row=feature]')).toHaveCount(20);
  await expect(page.getByRole('link', { name: '요구사항 3개 더 →' })).toBeVisible();
  await expect(page.locator('tbody tr[data-row=requirement]')).toHaveCount(12 + 19);
  await page.getByRole('button', { name: '기능 더 보기' }).click();
  await expect(page.locator('tbody tr[data-row=feature]')).toHaveCount(22);
  await expect(page.locator('tbody tr[data-row=feature]').last()).toContainText('기능 21');
  await expect(page.getByRole('button', { name: '기능 더 보기' })).toHaveCount(0);
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
    // The table is laid out under the loader before it shows; the header is measured once the loader has gone.
    await expect(page.getByRole('status', { name: '불러오는 중' })).toHaveCount(0);
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

test('the requirements tab opens with the feature introduction, and a requirement body resolves its links from its own file', async ({ page }) => {
  const linked = structuredClone(many);
  linked.features[1]!.body = '알림 기능의 **범위**를 적은 소개 문단이다.';
  // Written in requirements/<id>.md: one folder up is the feature folder, where design/overview.md is.
  linked.features[1]!.requirements[0]!.body = '표시 방식은 [알림 설계](../design/overview.md)를 따른다.';
  await mockApi(page);
  await serve(page, linked);
  await page.goto('/features/S-bbbbbbbbbb');
  await expect(page.getByRole('tab')).toHaveCount(2);
  const panel = page.getByRole('tabpanel', { name: '요구사항' });
  await expect(panel).toContainText('알림 기능의 범위를 적은 소개 문단이다.');
  await panel.locator('#R-bbbbbbbbbb').getByRole('link', { name: '알림 설계' }).click();
  await expect(page).toHaveURL(/tab=design/);
  await expect(page.getByRole('tabpanel', { name: '설계' })).toContainText('알림은 서버가 밀지 않고 조회로 읽는다.');
});

test('on a wide screen the index stands to the right and marks the requirement being read; on a narrow one it heads them', async ({ page }) => {
  const long = structuredClone(many);
  long.features[1]!.requirements = long.features[1]!.requirements.map(r => ({ ...r, body: (r.body + ' 본문이 한 화면을 넘도록 길게 이어집니다.').repeat(40) }));
  await mockApi(page);
  await serve(page, long);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/features/S-bbbbbbbbbb');
  const index = page.getByRole('navigation', { name: '명세 목차' });
  const first = page.locator('#R-bbbbbbbbbb');
  // Beside the requirements, not above them.
  await expect.poll(async () => (await index.boundingBox())!.x).toBeGreaterThan((await first.boundingBox())!.x + (await first.boundingBox())!.width - 1);
  await expect(index.locator('a[aria-current]')).toHaveText(/알림 표시/);
  await page.locator('#R-bbbbbbbbbd').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  await expect(index.locator('a[aria-current]')).toHaveText(/알림 모아보기/);
  // Still in view after scrolling.
  await expect.poll(async () => (await index.boundingBox())!.y).toBeLessThan(200);
  await page.setViewportSize({ width: 800, height: 900 });
  await expect.poll(async () => (await index.boundingBox())!.y).toBeLessThan((await page.locator('#R-bbbbbbbbbb').boundingBox())!.y);
});
