import { expect, test } from '@playwright/test';
import { mockApi, specs, serve } from './mock-api';

// Every case below is one wiki page, because the document body renders the same way for wiki pages and specs.
function withBody(body: string) {
  const payload = structuredClone(specs);
  payload.documents[1]!.body = body;
  return payload;
}
async function openPage(page: Parameters<typeof mockApi>[0], body: string) {
  await mockApi(page);
  await serve(page, withBody(body));
  await page.goto('/wiki/W-bbbbbbbbbb');
}

test('a mermaid fence is drawn as a diagram, other fences stay code', async ({ page }) => {
  await openPage(page, '# 흐름\n\n```mermaid\nflowchart TD\n  A[요청] --> B[응답]\n```\n\n```ts\nconst x = 1;\n```');
  const diagram = page.getByRole('img', { name: '다이어그램' });
  await expect(diagram.locator('svg')).toBeVisible();
  // The node labels come from the source, so the diagram is the source and not a placeholder.
  await expect(diagram).toContainText('요청');
  await expect(diagram).toContainText('응답');
  await expect(page.getByText('const x = 1;')).toBeVisible();
  // The diagram never pushes the page sideways, even in the narrow layout.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a diagram that cannot be parsed keeps its source and says why', async ({ page }) => {
  await openPage(page, '```mermaid\nflowchart TD\n  A[[[\n```');
  await expect(page.getByText('다이어그램을 그릴 수 없어')).toBeVisible();
  await expect(page.getByText('flowchart TD')).toBeVisible();
});

test('a mermaid source cannot script the page', async ({ page }) => {
  await openPage(page, '```mermaid\nflowchart TD\n  A["<img src=x onerror=\'window.bad=true\'>"] --> B\n  click A call window.alert()\n```');
  await expect(page.getByRole('img', { name: '다이어그램' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { bad?: boolean }).bad)).toBeUndefined();
  await expect(page.locator('article script, [role="region"] script')).toHaveCount(0);
});

test('GitHub alerts become labelled boxes and other quotes stay quotes', async ({ page }) => {
  await openPage(page, '> [!NOTE]\n> 참고할 내용입니다.\n\n> [!WARNING]\n> 조심할 내용입니다.\n\n> 그냥 인용입니다.');
  await expect(page.getByText('참고', { exact: true })).toBeVisible();
  await expect(page.getByText('참고할 내용입니다.')).toBeVisible();
  await expect(page.getByText('경고', { exact: true })).toBeVisible();
  // The marker itself is never shown as text.
  await expect(page.getByText('[!NOTE]')).toHaveCount(0);
  await expect(page.locator('blockquote')).toHaveCount(1);
  await expect(page.locator('blockquote')).toContainText('그냥 인용입니다.');
});

test('an alert keeps the markup inside it', async ({ page }) => {
  await openPage(page, '> [!TIP]\n> **굵게**와 [링크](../naming.md)를 담습니다.');
  await expect(page.getByText('팁', { exact: true })).toBeVisible();
  await expect(page.getByText('굵게')).toBeVisible();
  await page.getByRole('link', { name: '링크' }).click();
  await expect(page).toHaveURL(/\/wiki\/W-cccccccccc$/);
});

test('a node is drawn wide enough for its own label', async ({ page }) => {
  // mermaid 12.0.0 measured every label as the same width, so long labels hung outside their boxes and were cut.
  // The labels below differ enough in width that a version measuring them properly cannot draw equal boxes.
  await openPage(page, ['```mermaid', 'flowchart LR',
    '  A[짧게] --> B["아주 긴 이름을 가진 단계 · .gitifact/spec"]', '```'].join('\n'));
  await page.getByRole('img', { name: '다이어그램' }).locator('svg').waitFor();
  const boxes = await page.evaluate(() => [...document.querySelectorAll('figure svg g.node')].map(node => {
    const shape = node.querySelector<SVGGraphicsElement>('rect, polygon, path');
    const label = node.querySelector<SVGGraphicsElement>('text, .label');
    return { box: shape?.getBBox().width ?? 0, label: label?.getBBox().width ?? 0 };
  }));
  expect(boxes).toHaveLength(2);
  for (const { box, label } of boxes) expect(box).toBeGreaterThanOrEqual(label);
  expect(boxes[1]!.box).toBeGreaterThan(boxes[0]!.box);
});

test('drawing diagrams never makes the document itself scroll', async ({ page }) => {
  await mockApi(page);
  // The shell is viewport-sized and the content card scrolls, so the document must never grow past the viewport.
  // Mermaid measures a diagram by putting it in the document, and measuring inside <body> grew it tall enough for a
  // scrollbar that appeared and vanished between renders, shifting the whole page sideways.
  const diagram = (n: number) => ['```mermaid', 'flowchart TD',
    ...Array.from({ length: 12 }, (_, i) => `  A${n}${i}[아주 긴 이름을 가진 단계 ${i}] --> A${n}${i + 1}[다음 단계 ${i}]`),
    '```'].join('\n');
  const payload = structuredClone(specs);
  payload.documents[2]!.body = `${diagram(1)}\n\n${diagram(2)}`;
  await serve(page, payload);
  // The first load has settling of its own, so the watch starts on a page without diagrams and the diagrams are
  // opened from there without remounting the shell.
  await page.goto('/wiki/W-bbbbbbbbbb');
  await expect(page.getByText('중앙 컬럼은 64rem입니다.')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { overflow: number };
    w.overflow = 0;
    const watch = () => {
      const root = document.documentElement;
      w.overflow = Math.max(w.overflow, root.scrollHeight - root.clientHeight, root.scrollWidth - root.clientWidth);
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.getByRole('navigation', { name: '위키 트리' }).getByText('naming.md', { exact: true }).click();
  await page.getByRole('img', { name: '다이어그램' }).nth(1).locator('svg').waitFor();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { overflow: number }).overflow)).toBe(0);
});

// Every palette declares its colours as light-dark() pairs, which mermaid cannot parse; the diagram has to be handed
// the colours the browser resolved, or nothing is drawn. Checked in each mode, since the pair resolves differently.
for (const scheme of ['light', 'dark'] as const) test(`a diagram is drawn in every palette (${scheme})`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: scheme });
  for (const palette of ['stone', 'sage']) {
    await page.addInitScript(value => { window.localStorage.setItem('gitifact-appearance', value); }, JSON.stringify({ mode: 'system', palette }));
    await openPage(page, '```mermaid\nflowchart LR\n  A[시작] --> B[끝]\n```');
    const diagram = page.getByRole('img', { name: '다이어그램' });
    await expect(diagram.locator('svg')).toBeVisible();
    // The text in the drawing is the page's text colour, resolved to a plain value.
    const fill = await diagram.locator('svg text, svg tspan').first().evaluate(e => getComputedStyle(e).fill);
    expect(fill).toMatch(/^rgb/);
  }
});
