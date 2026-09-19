import type { IncomingMessage, ServerResponse } from 'node:http';
import { fail } from './respond.js';
import { t } from '../../shared/i18n/index.js';

export interface Admitted { url: URL; path: string; api: boolean; allowedOrigin: boolean }

/**
 * The checks every request passes before any route or file is looked at. The server listens on 127.0.0.1 only, yet
 * a page on another site can still make the browser send it requests, so the host and origin must be this server's,
 * API calls from another site are refused, paths cannot climb out, and no request carries a body.
 * Returns what the request asked for, or nothing after answering the refusal itself.
 */
export function admit(request: IncomingMessage, response: ServerResponse, origin: string, dev: boolean): Admitted | undefined {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (request.headers.host !== new URL(origin).host) { fail(response, 403, 'FORBIDDEN', t('server.forbiddenHost')); return; }
  const requestOrigin = request.headers.origin;
  // The Vite dev server proxies the API during development; nothing else may call it from a page.
  const allowedOrigin = requestOrigin === origin || (dev && requestOrigin === 'http://127.0.0.1:5173');
  if (requestOrigin && !allowedOrigin) { fail(response, 403, 'FORBIDDEN', t('server.forbiddenOrigin')); return; }
  const raw = request.url ?? '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) { fail(response, 400, 'BAD_REQUEST', t('server.badPath')); return; }
  let url: URL; let path: string;
  try { url = new URL(raw, origin); path = decodeURIComponent(url.pathname); }
  catch { fail(response, 400, 'BAD_REQUEST', t('server.badPath')); return; }
  if (path.includes('\0') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) { fail(response, 400, 'BAD_REQUEST', t('server.badPath')); return; }
  if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
    request.resume(); fail(response, 400, 'BAD_REQUEST', t('server.noBody')); return;
  }
  const api = path === '/api' || path.startsWith('/api/');
  if (api && request.headers['sec-fetch-site'] === 'cross-site' && !allowedOrigin) { fail(response, 403, 'FORBIDDEN', t('server.crossSite')); return; }
  return { url, path, api, allowedOrigin: !!allowedOrigin };
}
