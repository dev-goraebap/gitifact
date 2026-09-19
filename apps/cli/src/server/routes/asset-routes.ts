import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isAssetPath, assetExtension, ASSETS_DIR } from '@gitifact/core';
import { contentType } from '../http/static-files.js';
import { HttpError } from '../http/respond.js';
import { route } from '../http/router.js';
import { t } from '../../shared/i18n/index.js';

/**
 * Files under .gitifact/assets by path, for the images and attachments documents link to. An <img> request carries
 * no session header, so the route needs none and stays read-only and narrow: store assets only, no links, 20 MB.
 */
export function assetRoutes(root: string) {
  return [
    route({ method: 'GET', path: '/api/v1/assets/*', session: false, handle: async ({ path, response }) => {
      const relative = path.slice('/api/v1/assets/'.length); const assetPath = ASSETS_DIR + '/' + relative;
      if (!isAssetPath(assetPath)) throw new HttpError(404, 'NOT_FOUND', t('server.assetNotFound'));
      const file = join(root, ...assetPath.split('/'));
      const stat = await lstat(file).catch(() => undefined);
      if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 20 * 1024 * 1024) throw new HttpError(404, 'NOT_FOUND', t('server.assetNotFound'));
      const bytes = await readFile(file); const extension = assetExtension(relative);
      // Images render inline; everything else downloads. The sandbox keeps an SVG opened directly from running scripts.
      const inline = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension);
      response.writeHead(200, { 'Content-Type': contentType('.' + extension), 'Cache-Control': 'no-cache', 'Content-Length': bytes.length,
        'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': inline ? 'inline' : 'attachment; filename="' + encodeURIComponent(relative.split('/').pop()!) + '"' });
      response.end(bytes);
      return undefined;
    } }),
  ];
}
