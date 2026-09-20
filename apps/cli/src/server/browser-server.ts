import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readRepositoryStatus } from '@gitifact/core';
import type { RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { statusDto } from '../output/repository-status.js';
import { createStatusSession } from './status-session.js';
import { admit } from './http/guard.js';
import { fail } from './http/respond.js';
import { dispatch } from './http/router.js';
import { loadBrowserAssets, serveStatic } from './http/static-files.js';
import { projectRoutes } from './routes/project-routes.js';
import { recordRoutes } from './routes/record-routes.js';
import { assetRoutes } from './routes/asset-routes.js';
import { t, resolveLanguage, getLanguage, withLanguage } from '../shared/i18n/index.js';
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

/**
 * The read-only browser server: the built app and its API on 127.0.0.1.
 *
 * A request passes the guard (http/guard.ts), then goes to the route table (routes/*, dispatched by http/router.ts)
 * when it is an API call and to the app's files otherwise. This file only starts, wires and stops the server.
 */
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
  const root = initial.repository.rootPath;
  const routes = [
    ...projectRoutes(store, options.readChangelog ?? readBundledChangelog),
    ...recordRoutes(root, sessionId, options.env),
    ...assetRoutes(root),
  ];
  let updatePending: Promise<void> | undefined;
  let closing = false;
  let origin = '';

  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 }, (request, response) => {
    const header = request.headers['accept-language'];
    const language = typeof header === 'string' ? resolveLanguage(header.split(',')[0]?.split(';')[0]?.trim()) : getLanguage();
    void withLanguage(language, async () => {
      if (closing) return fail(response, 503, 'SERVER_CLOSING', t('server.closing'));
      const admitted = admit(request, response, origin, !!options.dev);
      if (!admitted) return;
      if (admitted.api) return dispatch(routes, sessionId, admitted.url, admitted.path, request, response, admitted.allowedOrigin);
      return serveStatic(request, response, admitted.path, assets);
    }).catch(() => {
      if (!response.headersSent && !response.destroyed) fail(response, 500, 'INTERNAL_ERROR', t('server.internal', {}, language));
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
