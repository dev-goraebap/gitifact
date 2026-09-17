import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readRepositoryStatus, isProductAssetPath, parseChangelog } from '@gitifact/core';
import { browserHttpErrorV1, changelogV1 } from '@gitifact/contracts';
import type { RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { statusDto } from '../output/repository-status.js';
import { loadBrowserAssets, contentType } from './assets.js';
import { createStatusSession } from './status-session.js';
import { createSpecBrowserReader } from './spec-reader.js';
import { defaultLanguage, t } from '../shared/i18n/index.js';
import { checkingUpdate, resolveUpdate } from '../shared/update-check.js';
import type { FetchLatestVersion } from '../adapters/registry/latest-version.js';

interface Options {
  cwd: string;
  port?: number;
  dev?: boolean;
  assetsDirectory?: string;
  signal?: AbortSignal;
  // Tests use this boundary to control concurrent reads and failures.
  readStatus?: (signal: AbortSignal) => Promise<RepositoryStatusSuccessV1>;
  env?: NodeJS.ProcessEnv;
  // The running CLI version, the same value as `gitifact --version`.
  cliVersion?: string;
  // Asks the npm registry for the latest release once after startup. Omitted means the check is disabled.
  fetchLatest?: FetchLatestVersion;
  updateCheckTimeoutMs?: number;
  // Release notes source for one language; null when that language has no notes. Tests inject it because .test-build has no assets.
  readChangelog?: (language: string) => Promise<string | null>;
}
const readBundledChangelog = (language: string) => readFile(new URL('./i18n/' + language + '/changelog.md', import.meta.url), 'utf8')
  .catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; });
export async function startBrowserServer(options: Options) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const read = options.readStatus ?? (async (signal: AbortSignal) =>
    statusDto(await readRepositoryStatus(
      createRepositoryReader(options.cwd, { signal, ...(options.env ? { env: options.env } : {}) }),
      { now: () => new Date().toISOString(), newId: randomUUID },
    )));
  let assets: Map<string, Buffer>;
  let initial: RepositoryStatusSuccessV1;
  try {
    assets = await loadBrowserAssets(options.assetsDirectory ?? fileURLToPath(new URL('./browser/', import.meta.url)));
    initial = await read(controller.signal);
    controller.signal.throwIfAborted();
  } catch (error) {
    options.signal?.removeEventListener('abort', onAbort);
    throw error;
  }
  const store = createStatusSession(initial, () => read(controller.signal), options.cliVersion);
  const sessionId = store.session.sessionId;
  const readChangelog = options.readChangelog ?? readBundledChangelog;
  let updatePending: Promise<void> | undefined;
  let closing = false;
  let origin = '';
  const readSpecs = createSpecBrowserReader(initial.repository.rootPath, sessionId, options.env);
  function json(response: ServerResponse, status: number, value: unknown) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value) + '\n');
  }
  function fail(response: ServerResponse, status: number, code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'SESSION_CHANGED' | 'SERVER_CLOSING' | 'INTERNAL_ERROR', message: string) {
    json(response, status, browserHttpErrorV1.parse({ contract: 'browser-http-error', version: 1, error: { code, message } }));
  }
  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (closing) return fail(response, 503, 'SERVER_CLOSING', t('server.closing'));
    if (request.headers.host !== new URL(origin).host) return fail(response, 403, 'FORBIDDEN', t('server.forbiddenHost'));
    const requestOrigin = request.headers.origin;
    const allowedOrigin = requestOrigin === origin || (options.dev && requestOrigin === 'http://127.0.0.1:5173');
    if (requestOrigin && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', t('server.forbiddenOrigin'));
    const raw = request.url ?? '/';
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fail(response, 400, 'BAD_REQUEST', t('server.badPath'));
    let url: URL;
    let path: string;
    try {
      url = new URL(raw, origin);
      path = decodeURIComponent(url.pathname);
    } catch { return fail(response, 400, 'BAD_REQUEST', t('server.badPath')); }
    if (path.includes('\0') || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '.')) {
      return fail(response, 400, 'BAD_REQUEST', t('server.badPath'));
    }
    if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      request.resume();
      return fail(response, 400, 'BAD_REQUEST', t('server.noBody'));
    }
    const api = path === '/api' || path.startsWith('/api/');
    if (api) {
      if (request.headers['sec-fetch-site'] === 'cross-site' && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', t('server.crossSite'));
      if (url.search && path !== '/api/v1/specs' && path !== '/api/v1/changelog') return fail(response, 400, 'BAD_REQUEST', t('server.noQuery'));
      // Images beside PRODUCT.md, by plain file name only: <img> requests carry no session header, so the route stays read-only and narrow.
      if (path.startsWith('/api/v1/product/assets/')) {
        const name = path.slice('/api/v1/product/assets/'.length);
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return fail(response, 405, 'METHOD_NOT_ALLOWED', t('server.methodNotAllowed')); }
        if (!isProductAssetPath('.gitifact/product/' + name)) return fail(response, 404, 'NOT_FOUND', t('server.productImageNotFound'));
        const file = join(initial.repository.rootPath, '.gitifact', 'product', name);
        const stat = await lstat(file).catch(() => undefined);
        if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 5 * 1024 * 1024) return fail(response, 404, 'NOT_FOUND', t('server.productImageNotFound'));
        const bytes = await readFile(file);
        response.writeHead(200, { 'Content-Type': contentType(name.toLowerCase()), 'Cache-Control': 'no-cache', 'Content-Length': bytes.length });
        response.end(bytes); return;
      }
      const method = path === '/api/v1/status/refresh' ? 'POST' : 'GET';
      if (!['/api/v1/session', '/api/v1/status', '/api/v1/status/refresh', '/api/v1/specs', '/api/v1/changelog'].includes(path)) return fail(response, 404, 'NOT_FOUND', t('server.apiNotFound'));
      if (request.method !== method) {
        response.setHeader('Allow', method);
        return fail(response, 405, 'METHOD_NOT_ALLOWED', t('server.methodNotAllowed'));
      }
      // Re-reading the session never contacts the registry; it returns the state the single startup check left.
      if (path === '/api/v1/session') return json(response, 200, store.session);
      if (request.headers['x-gitifact-session'] !== sessionId) return fail(response, 409, 'SESSION_CHANGED', t('server.sessionChanged'));
      if (path === '/api/v1/specs') {
        const cursor = url.searchParams.get('cursor') ?? '0'; const head = url.searchParams.get('head');
        if ([...url.searchParams.keys()].some(k => !['cursor','head'].includes(k)) || url.searchParams.getAll('cursor').length > 1 || url.searchParams.getAll('head').length > 1
          || !/^(0|[1-9]\d{0,5})$/.test(cursor) || (head !== null && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head))) return fail(response,400,'BAD_REQUEST',t('server.badRange'));
        try { json(response,200,await readSpecs(Number(cursor), head ?? undefined)); }
        catch (error) { fail(response,503,'INTERNAL_ERROR',error instanceof Error ? error.message : t('server.specsUnreadable')); }
        return;
      }
      if (path === '/api/v1/changelog') {
        const language = url.searchParams.get('lang') ?? defaultLanguage;
        if ([...url.searchParams.keys()].some(key => key !== 'lang') || url.searchParams.getAll('lang').length > 1 || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)) return fail(response, 400, 'BAD_REQUEST', t('server.badLanguage'));
        try {
          // A language without notes falls back to the default one, and the answer says so.
          const own = await readChangelog(language);
          const text = own ?? (language === defaultLanguage ? null : await readChangelog(defaultLanguage));
          if (text === null) return fail(response, 404, 'NOT_FOUND', t('server.changelogNotFound'));
          json(response, 200, changelogV1.parse({ contract: 'changelog', version: 1, language: own === null ? defaultLanguage : language, fallback: own === null, entries: parseChangelog(text) }));
        } catch (error) { fail(response, 503, 'INTERNAL_ERROR', error instanceof Error ? error.message : t('server.changelogUnreadable')); }
        return;
      }
      if (method === 'POST' && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', t('server.refreshOrigin'));
      const value = method === 'POST' ? await store.refresh() : store.latest;
      if (!response.destroyed) json(response, value.ok ? 200 : 503, value);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      return fail(response, 405, 'METHOD_NOT_ALLOWED', t('server.methodNotAllowed'));
    }
    let asset = assets.get(path === '/' ? '/index.html' : path);
    let assetPath = path === '/' ? '/index.html' : path;
    if (!asset && !path.startsWith('/assets/') && !path.split('/').some((part) => part.includes('.'))
      && request.headers.accept?.includes('text/html')) {
      asset = assets.get('/index.html');
      assetPath = '/index.html';
    }
    if (!asset) return fail(response, 404, 'NOT_FOUND', t('server.fileNotFound'));
    response.writeHead(200, { 'Content-Type': contentType(assetPath), 'Cache-Control': 'no-cache', 'Content-Length': asset.length });
    response.end(request.method === 'HEAD' ? undefined : asset);
  }
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 }, (request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent && !response.destroyed) fail(response, 500, 'INTERNAL_ERROR', t('server.internal'));
      else response.destroy();
    });
  });
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (error) {
    options.signal?.removeEventListener('abort', onAbort);
    controller.abort();
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new Error(t('server.portInUse'));
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error(t('server.addressUnknown'));
  origin = 'http://127.0.0.1:' + address.port;
  // One registry request per server start, in the background so neither startup nor any page waits for it.
  if (options.fetchLatest) {
    store.setUpdate(checkingUpdate);
    updatePending = resolveUpdate(store.session.cliVersion, options.fetchLatest, controller.signal, options.updateCheckTimeoutMs).then(state => { store.setUpdate(state); });
  }
  let resolveClosed: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
  let shutdown: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (shutdown) return shutdown;
    closing = true;
    controller.abort();
    shutdown = (async () => {
      await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
      await store.pending;
      await updatePending;
      options.signal?.removeEventListener('abort', onAbort);
      options.signal?.removeEventListener('abort', closeOnAbort);
      resolveClosed!();
    })();
    return shutdown;
  };
  const closeOnAbort = () => { void close(); };
  options.signal?.addEventListener('abort', closeOnAbort, { once: true });
  if (options.signal?.aborted) void close();
  return { url: origin, get session() { return store.session; }, close, closed };
}
