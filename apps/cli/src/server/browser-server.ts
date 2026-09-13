import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRepositoryStatus } from '@tryce/core';
import { browserHttpErrorV1 } from '@tryce/contracts';
import type { RepositoryStatusSuccessV1 } from '@tryce/contracts';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { statusDto } from '../output/repository-status.js';
import { loadBrowserAssets, contentType } from './assets.js';
import { createStatusSession } from './status-session.js';
import { readBrowserProject } from './project-reader.js';

interface Options {
  cwd: string;
  port?: number;
  dev?: boolean;
  assetsDirectory?: string;
  signal?: AbortSignal;
  // Tests use this boundary to control concurrent reads and failures.
  readStatus?: (signal: AbortSignal) => Promise<RepositoryStatusSuccessV1>;
  env?: NodeJS.ProcessEnv;
}
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
  const store = createStatusSession(initial, () => read(controller.signal));
  const { session } = store;
  let closing = false;
  let origin = '';
  let pendingProject: ReturnType<typeof readBrowserProject> | undefined;
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
    if (closing) return fail(response, 503, 'SERVER_CLOSING', '서버를 종료하고 있습니다.');
    if (request.headers.host !== new URL(origin).host) return fail(response, 403, 'FORBIDDEN', '허용하지 않는 Host입니다.');
    const requestOrigin = request.headers.origin;
    const allowedOrigin = requestOrigin === origin || (options.dev && requestOrigin === 'http://127.0.0.1:5173');
    if (requestOrigin && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', '허용하지 않는 Origin입니다.');
    const raw = request.url ?? '/';
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fail(response, 400, 'BAD_REQUEST', '잘못된 경로입니다.');
    let url: URL;
    let path: string;
    try {
      url = new URL(raw, origin);
      path = decodeURIComponent(url.pathname);
    } catch { return fail(response, 400, 'BAD_REQUEST', '잘못된 경로입니다.'); }
    if (path.includes('\0') || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '.')) {
      return fail(response, 400, 'BAD_REQUEST', '잘못된 경로입니다.');
    }
    if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      request.resume();
      return fail(response, 400, 'BAD_REQUEST', '요청 본문을 받지 않습니다.');
    }
    const api = path === '/api' || path.startsWith('/api/');
    if (api) {
      if (request.headers['sec-fetch-site'] === 'cross-site' && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', '외부 페이지의 요청을 허용하지 않습니다.');
      if (url.search) return fail(response, 400, 'BAD_REQUEST', '조회 인자를 받지 않습니다.');
      const method = path === '/api/v1/status/refresh' ? 'POST' : 'GET';
      if (!['/api/v1/session', '/api/v1/status', '/api/v1/status/refresh', '/api/v1/project'].includes(path)) return fail(response, 404, 'NOT_FOUND', 'API를 찾을 수 없습니다.');
      if (request.method !== method) {
        response.setHeader('Allow', method);
        return fail(response, 405, 'METHOD_NOT_ALLOWED', '허용하지 않는 메서드입니다.');
      }
      if (path === '/api/v1/session') return json(response, 200, session);
      if (request.headers['x-tryce-session'] !== session.sessionId) return fail(response, 409, 'SESSION_CHANGED', '서버 세션이 변경됐습니다. 다시 연결하세요.');
      if (path === '/api/v1/project') {
        pendingProject ??= readBrowserProject(initial.repository.rootPath, options.env).finally(() => { pendingProject = undefined; });
        const project = await pendingProject;
        const repository = project.brief.report?.repository;
        if (repository && (repository.key !== session.repository.key || repository.worktreeKey !== session.repository.worktreeKey)) {
          return fail(response, 409, 'SESSION_CHANGED', '다른 checkout이 감지됐습니다. 서버를 다시 시작하세요.');
        }
        if (!response.destroyed) json(response, 200, project);
        return;
      }
      if (method === 'POST' && !allowedOrigin) return fail(response, 403, 'FORBIDDEN', '새로고침에는 같은 출처의 Origin이 필요합니다.');
      const value = method === 'POST' ? await store.refresh() : store.latest;
      if (!response.destroyed) json(response, value.ok ? 200 : 503, value);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      return fail(response, 405, 'METHOD_NOT_ALLOWED', '허용하지 않는 메서드입니다.');
    }
    let asset = assets.get(path === '/' ? '/index.html' : path);
    let assetPath = path === '/' ? '/index.html' : path;
    if (!asset && !path.startsWith('/assets/') && !path.split('/').some((part) => part.includes('.'))
      && request.headers.accept?.includes('text/html')) {
      asset = assets.get('/index.html');
      assetPath = '/index.html';
    }
    if (!asset) return fail(response, 404, 'NOT_FOUND', '파일을 찾을 수 없습니다.');
    response.writeHead(200, { 'Content-Type': contentType(assetPath), 'Cache-Control': 'no-cache', 'Content-Length': asset.length });
    response.end(request.method === 'HEAD' ? undefined : asset);
  }
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 }, (request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent && !response.destroyed) fail(response, 500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
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
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new Error('요청한 포트가 사용 중입니다. 다른 포트를 선택하세요.');
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('서버 주소를 확인하지 못했습니다.');
  origin = 'http://127.0.0.1:' + address.port;
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
      await pendingProject?.catch(() => undefined);
      options.signal?.removeEventListener('abort', onAbort);
      options.signal?.removeEventListener('abort', closeOnAbort);
      resolveClosed!();
    })();
    return shutdown;
  };
  const closeOnAbort = () => { void close(); };
  options.signal?.addEventListener('abort', closeOnAbort, { once: true });
  if (options.signal?.aborted) void close();
  return { url: origin, session, close, closed };
}
