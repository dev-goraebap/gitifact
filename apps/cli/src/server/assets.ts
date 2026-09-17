import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { t } from '../shared/i18n/index.js';

export async function loadBrowserAssets(directory: string): Promise<Map<string, Buffer>> {
  const assets = new Map<string, Buffer>();
  async function walk(current: string, prefix: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(t('browser.assetSymlink'));
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), name + '/');
      else if (entry.isFile()) assets.set('/' + name, await readFile(join(current, entry.name)));
    }
  }
  try {
    await walk(directory, '');
    if (!assets.has('/index.html')) throw new Error('missing index');
  } catch {
    throw new Error(t('browser.assetsUnreadable'));
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
  if (/\.jpe?g$/.test(path)) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}
