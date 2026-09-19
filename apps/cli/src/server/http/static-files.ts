import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fail } from './respond.js';
import { t } from '../../shared/i18n/index.js';

/** The built browser app, read into memory once at startup; a symbolic link in it is refused. */
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
  if (path.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

/**
 * A file of the app, or the app itself for a route the browser navigates to: a page request (Accept: text/html) for
 * a path without an extension gets index.html, so a reload on /features/S-… still opens the app.
 */
export function serveStatic(request: IncomingMessage, response: ServerResponse, path: string, assets: Map<string, Buffer>) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return fail(response, 405, 'METHOD_NOT_ALLOWED', t('server.methodNotAllowed'));
  }
  let assetPath = path === '/' ? '/index.html' : path;
  let asset = assets.get(assetPath);
  if (!asset && !path.startsWith('/assets/') && !path.split('/').some(part => part.includes('.')) && request.headers.accept?.includes('text/html')) {
    asset = assets.get('/index.html'); assetPath = '/index.html';
  }
  if (!asset) return fail(response, 404, 'NOT_FOUND', t('server.fileNotFound'));
  response.writeHead(200, { 'Content-Type': contentType(assetPath), 'Cache-Control': 'no-cache', 'Content-Length': asset.length });
  response.end(request.method === 'HEAD' ? undefined : asset);
}
