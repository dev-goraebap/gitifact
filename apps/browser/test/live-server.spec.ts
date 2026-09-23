import { expect, test } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

test('bundled CLI serves a real checkout and refreshes changed files in the browser', async ({ page }) => {
  const base = await realpath(tmpdir());
  const directory = await mkdtemp(join(base, 'gitifact-browser-'));
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  execFileSync('git', ['init', '--template=', '-b', 'main'], { cwd: directory, env, stdio: 'pipe' });
  const beforeHead = await readFile(join(directory, '.git', 'HEAD'));
  const entry = fileURLToPath(new URL('../../cli/dist/main.js', import.meta.url));
  const child = spawn(process.execPath, [entry, 'browser'], {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const exited = once(child, 'exit');
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let output = '';
      let diagnostics = '';
      const timer = setTimeout(() => reject(new Error('CLI server startup timeout')), 15000);
      child.stdout.on('data', (buffer: Buffer) => {
        output += buffer.toString();
        if (output.includes('\n')) {
          clearTimeout(timer);
          resolve(output.trim());
        }
      });
      child.stderr.on('data', (buffer: Buffer) => {
        diagnostics += buffer.toString();
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('CLI exited before startup: ' + diagnostics));
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(new URL('/git', url).href);
    await expect(page.getByRole('heading', { name: '변경된 파일이 없습니다' })).toBeVisible();
    await writeFile(join(directory, 'actual-file.txt'), 'new work\n');
    await page.getByRole('button', { name: '상태 새로고침' }).click();
    await expect(page.getByRole('cell', { name: 'actual-file.txt', exact: true })).toBeVisible();
    await expect(page.getByText('gitifact 요구사항 검사는 아직 실행하지 않습니다.')).toBeVisible();
    await page.goto(new URL('/about', url).href);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gitifact 소개');
    await page.getByRole('link', { name: '시작하기', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('시작하기');
    await expect(page.getByRole('article')).toContainText('npx gitifact docs list');
    await page.getByRole('link', { name: 'Git 상태', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'actual-file.txt', exact: true })).toBeVisible();
    expect(await readFile(join(directory, '.git', 'HEAD'))).toEqual(beforeHead);
    expect(await readFile(join(directory, 'actual-file.txt'), 'utf8')).toBe('new work\n');
    expect(errors).toEqual([]);
  } finally {
    child.kill();
    await exited;
    if (dirname(await realpath(directory)) !== base) throw new Error('Unexpected fixture path');
    await rm(directory, { recursive: true, force: true });
  }
});
