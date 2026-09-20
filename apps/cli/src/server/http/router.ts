import type { IncomingMessage, ServerResponse } from 'node:http';
import { fail, HttpError, json } from './respond.js';
import { t } from '../../shared/i18n/index.js';

/** The part of a zod schema the router uses; the schemas themselves live in @gitifact/contracts. */
interface QuerySchema<Q> { safeParse(input: unknown): { success: true; data: Q } | { success: false } }
export interface RouteContext<Q> { query: Q; path: string; request: IncomingMessage; response: ServerResponse; allowedOrigin: boolean }
/** What a route answers: a JSON value with its status, or nothing when it wrote the response itself. */
export type Reply = { status: number; body: unknown } | undefined;
export interface Route<Q = Record<string, never>> {
  method: 'GET' | 'POST';
  /** An exact path, or a prefix ending in `/*` whose rest the route reads from `path`. */
  path: string;
  /** Whether the request must carry this server's session header. */
  session: boolean;
  /** The accepted query string; a route without one refuses any query. */
  query?: QuerySchema<Q>;
  /** The message a read failure is reported with when the error carries none. */
  unreadable?: () => string;
  handle(context: RouteContext<Q>): Promise<Reply> | Reply;
}
/** Declares a route with its query type inferred from the schema. */
export const route = <Q = Record<string, never>>(value: Route<Q>): Route<unknown> => value as Route<unknown>;
export const ok = (body: unknown): Reply => ({ status: 200, body });

const matches = (route: Route<unknown>, path: string) => route.path.endsWith('/*') ? path.startsWith(route.path.slice(0, -1)) : route.path === path;

/**
 * Answers one API request from the route table: the path, then the method, the query and the session, each refused
 * with its own status before the route runs. A route that throws answers 503 with the reason, except for the
 * refusals it raises itself (HttpError), which keep their status.
 */
export async function dispatch(routes: Route<unknown>[], sessionId: string, url: URL, path: string, request: IncomingMessage, response: ServerResponse, allowedOrigin: boolean) {
  const candidates = routes.filter(r => matches(r, path));
  if (!candidates.length) return fail(response, 404, 'NOT_FOUND', t('server.apiNotFound'));
  const found = candidates.find(r => r.method === request.method);
  if (!found) {
    response.setHeader('Allow', candidates.map(r => r.method).join(', '));
    return fail(response, 405, 'METHOD_NOT_ALLOWED', t('server.methodNotAllowed'));
  }
  let query: unknown = {};
  if (found.query) {
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length) return fail(response, 400, 'BAD_REQUEST', t('server.badRange'));
    const parsed = found.query.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail(response, 400, 'BAD_REQUEST', t('server.badRange'));
    query = parsed.data;
  } else if (url.search) return fail(response, 400, 'BAD_REQUEST', t('server.noQuery'));
  if (found.session && request.headers['x-gitifact-session'] !== sessionId) return fail(response, 409, 'SESSION_CHANGED', t('server.sessionChanged'));
  try {
    const reply = await found.handle({ query, path, request, response, allowedOrigin });
    if (reply && !response.destroyed) json(response, reply.status, reply.body);
  } catch (error) {
    if (error instanceof HttpError) return fail(response, error.status, error.code, error.message);
    fail(response, 503, 'INTERNAL_ERROR', error instanceof Error && error.message ? error.message : found.unreadable?.() ?? t('server.internal'));
  }
}
