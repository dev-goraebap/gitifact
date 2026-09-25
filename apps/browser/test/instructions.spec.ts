import { expect, test } from '@playwright/test';
import { mockApi, specs, instructionFiles, type Fixture } from './mock-api';

const I1 = 'I-aaaaaaaaaa', I2 = 'I-bbbbbbbbbb';
const agents = { path: 'AGENTS.md', body: '<!-- GITIFACT:START -->\n블록\n<!-- GITIFACT:END -->\n\n## 작업을 시작할 때\n\nCLI를 고치기 전에 [CLI 규칙](.gitifact/instructions/cli-rules/index.md)을 읽는다.', updatedAt: '2026-09-14T00:00:00Z' };
const withInstructions: Fixture = {
  ...specs,
  features: [{ ...specs.features[0]!, designs: [{ title: '검색 흐름', body: '검색한다.', requirements: [], sources: [{ id: I1, title: 'CLI 규칙' }] }] }],
  instructions: [
    { id: I1, name: 'cli-rules', title: 'CLI 규칙', description: 'CLI 계층 규칙. apps/cli를 고칠 때 읽는다',
      body: '계층을 지킨다. [결정 표](references/decisions.md) · [문체](../writing/index.md) · [상시 지침](../../../AGENTS.md)',
      files: [{ path: 'references/decisions.md', size: 40, title: '결정 모음' }, { path: 'scripts/check.sh', size: 12 }, { path: 'assets/logo.png', size: 2048 }], updatedAt: '2026-09-14T00:00:00Z' },
    { id: I2, name: 'writing', title: '문체', description: '문서를 쓸 때 읽는다', body: '짧게 쓴다.' },
  ],
  agents,
};
instructionFiles[I1 + ':references/decisions.md'] = { text: '| 결정 | 이유 |\n| --- | --- |\n| 계층을 나눈다 | 경계가 보인다 |\n\n[지침으로 돌아가기](../index.md)' };
instructionFiles[I1 + ':scripts/check.sh'] = { text: 'echo checked\n' };
instructionFiles[I1 + ':assets/logo.png'] = { text: null, binary: true };

test('the project instructions list AGENTS.md first, then the instructions for each kind of work by name', async ({ page }) => {
  await mockApi(page, withInstructions); await page.goto('/instructions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트 지침');
  await expect(page.getByRole('navigation').getByRole('link', { name: '프로젝트 지침' })).toBeVisible();
  const always = page.getByRole('list', { name: '상시 지침' });
  await expect(always).toContainText('AGENTS.md');
  const rows = page.getByRole('list', { name: '작업별 지침' }).getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('CLI 규칙'); await expect(rows.nth(0)).toContainText('cli-rules');
  await expect(page.getByText('작업별 지침 2개')).toBeVisible();
  // Instructions of one project never share a colour, and the detail keeps the one the list gave.
  const color = await rows.nth(0).locator('[data-instruction-color]').getAttribute('data-instruction-color');
  expect(await rows.nth(1).locator('[data-instruction-color]').getAttribute('data-instruction-color')).not.toBe(color);
  await rows.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/instructions\/I-aaaaaaaaaa$/);
  await expect(page.getByRole('article', { name: 'CLI 규칙' }).locator('[data-instruction-color]')).toHaveAttribute('data-instruction-color', color!);
});

test('AGENTS.md opens as a document whose links lead to the instructions it names', async ({ page }) => {
  await mockApi(page, withInstructions); await page.goto('/instructions');
  await page.getByRole('list', { name: '상시 지침' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/instructions\/agents$/);
  const article = page.getByRole('article', { name: 'AGENTS.md' });
  await expect(article).toContainText('CLI를 고치기 전에');
  // Tool markers such as the GITIFACT block comments are not shown as text.
  await expect(article).not.toContainText('GITIFACT:START');
  await article.getByRole('link', { name: 'CLI 규칙' }).click();
  await expect(page).toHaveURL(/\/instructions\/I-aaaaaaaaaa$/);
});

test('an instruction opens on index.md, reads the other files of its folder, and follows links out of them', async ({ page }) => {
  await mockApi(page, withInstructions); await page.goto('/instructions/' + I1);
  const article = page.getByRole('article', { name: 'CLI 규칙' });
  await expect(article).toContainText('계층을 지킨다.');
  const files = page.getByRole('navigation', { name: '파일' });
  // Files go by their titles: index.md by the instruction's, a Markdown file by its first heading, anything else by its name.
  await expect(files.getByRole('link', { name: 'CLI 규칙' })).toBeVisible(); await expect(files).toContainText('references/');
  await expect(files.getByRole('link', { name: '결정 모음' })).toBeVisible(); await expect(files).not.toContainText('decisions.md');
  // A folder starts open and folds away.
  await files.getByRole('button', { name: 'references/' }).click();
  await expect(files.getByRole('link', { name: '결정 모음' })).toBeHidden();
  await files.getByRole('button', { name: 'references/' }).click();
  await expect(files.getByRole('link', { name: '결정 모음' })).toBeVisible();
  await article.getByRole('link', { name: '결정 표' }).click();
  await expect(page).toHaveURL(/\/instructions\/I-aaaaaaaaaa\?file=references%2Fdecisions\.md$/);
  await expect(article.getByRole('table')).toContainText('계층을 나눈다');
  await article.getByRole('link', { name: '지침으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/instructions\/I-aaaaaaaaaa$/);
  await files.getByRole('link', { name: 'check.sh' }).click();
  await expect(article.locator('pre')).toContainText('echo checked');
  await files.getByRole('link', { name: 'logo.png' }).click();
  await expect(article).toContainText('텍스트가 아닌 파일이라');
  // Links reach other instructions and AGENTS.md; designs that follow the instruction are listed below.
  await files.getByRole('link', { name: 'CLI 규칙' }).click();
  await article.getByRole('link', { name: '문체' }).click();
  await expect(page).toHaveURL(/\/instructions\/I-bbbbbbbbbb$/);
  await page.goBack();
  await expect(page.getByRole('region', { name: '이 지침을 따르는 설계' })).toContainText('검색 흐름');
  await article.getByRole('link', { name: '상시 지침' }).click();
  await expect(page).toHaveURL(/\/instructions\/agents$/);
  // Both detail pages lead back to the list, as the other detail pages do.
  await page.getByRole('article', { name: 'AGENTS.md' }).getByRole('link', { name: '← 프로젝트 지침' }).click();
  await expect(page).toHaveURL(/\/instructions$/);
  await page.goto('/instructions/' + I1);
  await article.getByRole('link', { name: '← 프로젝트 지침' }).click();
  await expect(page).toHaveURL(/\/instructions$/);
});

test('an unknown instruction says so and leads back; the search finds instructions', async ({ page }) => {
  await mockApi(page, withInstructions); await page.goto('/instructions/I-zzzzzzzzzz');
  await expect(page.getByRole('heading', { name: '지침을 찾을 수 없습니다' })).toBeVisible();
  await page.getByRole('link', { name: '지침 목록으로' }).click();
  await expect(page).toHaveURL(/\/instructions$/);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('계층');
  await page.getByRole('option', { name: /CLI 규칙/ }).first().click();
  await expect(page).toHaveURL(/\/instructions\/I-aaaaaaaaaa$/);
});

test('with neither AGENTS.md nor instructions the page explains how they are made', async ({ page }) => {
  await mockApi(page, { ...specs, instructions: [], agents: null }); await page.goto('/instructions');
  await expect(page.getByRole('heading', { name: '프로젝트 지침이 아직 없습니다' })).toBeVisible();
  await page.goto('/instructions/agents');
  await expect(page.getByRole('heading', { name: 'AGENTS.md가 없습니다' })).toBeVisible();
});
