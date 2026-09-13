import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadBrowserAssets(directory: string): Promise<Map<string, Buffer>> {
  const assets = new Map<string, Buffer>();
  async function walk(current: string, prefix: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('브라우저 자산에 symlink를 사용할 수 없습니다.');
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), name + '/');
      else if (entry.isFile()) assets.set('/' + name, await readFile(join(current, entry.name)));
    }
  }
  try {
    await walk(directory, '');
    if (!assets.has('/index.html')) throw new Error('missing index');
  } catch {
    throw new Error('브라우저 빌드 자산을 읽지 못했습니다. pnpm build로 다시 빌드하세요.');
  }
  return assets;
}
export function contentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
