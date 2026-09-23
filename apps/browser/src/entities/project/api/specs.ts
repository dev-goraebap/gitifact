import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { browserSpecsV5, browserHistoryV3, browserHistorySummaryV2, browserSearchV1, browserCommitFilesV1, browserCommitFileV1, browserCommitV1, type BrowserSessionV3 } from '@gitifact/contracts';
import { requestJson, ApiError } from '../../../shared/api/client';
import { httpFailure } from './repository';
import { t } from '../../../shared/i18n';

/** Filters the server applies to the whole of history. */
export interface HistoryFilter { kind?: string | undefined; document?: string | undefined; feature?: string | undefined; author?: string | undefined; q?: string | undefined }

// Reads one API answer, checks its shape and that it came from this server session.
async function read<T extends { sessionId: string }>(session: BrowserSessionV3, path: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, signal?: AbortSignal): Promise<T> {
  const { response, data } = await requestJson(path, { ...(signal ? { signal } : {}), headers: { 'X-Gitifact-Session': session.sessionId } });
  if (!response.ok) return httpFailure(data);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(t('api.invalidSpecs'), 'INVALID_RESPONSE');
  if (parsed.data.sessionId !== session.sessionId) throw new ApiError(t('api.serverChanged'), 'SESSION_CHANGED');
  return parsed.data;
}
const scope = (session: BrowserSessionV3) => [window.location.origin, session.sessionId, session.repository.worktreeKey] as const;

/**
 * The checkout — current specs, wiki and contributors — read once and kept until the reader asks again. Every screen
 * that shows specs shares it, and the header's refresh button is how this project says an observation is explicit.
 */
export const specsOptions = (session: BrowserSessionV3) => queryOptions({
  queryKey: ['browser-specs', 5, ...scope(session)],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/specs', browserSpecsV5, signal),
});

/**
 * Changes of `head`'s history that match the filters, fifty at a time. The server filters and counts over all of
 * history, so a filter finds what was never loaded and `total` is the whole count. A HEAD's history never changes,
 * so its pages are kept for the session.
 */
export const historyOptions = (session: BrowserSessionV3, head: string, filter: HistoryFilter, limit = 50) => infiniteQueryOptions({
  queryKey: ['browser-history', 3, ...scope(session), head, filter, limit],
  initialPageParam: 0, staleTime: Infinity, retry: false,
  queryFn: ({ signal, pageParam }) => {
    const query = new URLSearchParams({ head, offset: String(pageParam), limit: String(limit) });
    for (const [key, value] of Object.entries(filter)) if (value) query.set(key, value);
    return read(session, '/api/v1/history?' + query, browserHistoryV3, signal);
  },
  getNextPageParam: last => last.offset + last.events.length < last.total ? last.offset + last.events.length : undefined,
});

/** Counts over all of `head`'s history and its newest commits, for the overview. */
export const summaryOptions = (session: BrowserSessionV3, head: string) => queryOptions({
  queryKey: ['browser-history-summary', 2, ...scope(session), head],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/history/summary?head=' + head, browserHistorySummaryV2, signal),
});

/** One commit with every document it changed and the text on both sides: what its page reads. A commit never changes. */
export const commitOptions = (session: BrowserSessionV3, commit: string) => queryOptions({
  queryKey: ['browser-commit', 1, ...scope(session), commit],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/commit?commit=' + commit, browserCommitV1, signal),
});

/** The source files a commit changed beside its documents. A commit never changes, so the answer is kept. */
export const commitFilesOptions = (session: BrowserSessionV3, commit: string) => queryOptions({
  queryKey: ['browser-commit-files', 1, ...scope(session), commit],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/commit/files?commit=' + commit, browserCommitFilesV1, signal),
});

/** One of those files on both sides, read when the reader opens it. */
export const commitFileOptions = (session: BrowserSessionV3, commit: string, path: string) => queryOptions({
  queryKey: ['browser-commit-file', 1, ...scope(session), commit, path],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/commit/file?' + new URLSearchParams({ commit, path }), browserCommitFileV1, signal),
});

/** Records whose title, place or text holds the words: the current specs and wiki, then past changes of `head`. */
export function searchRecords(session: BrowserSessionV3, words: string, head: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ q: words }); if (head) query.set('head', head);
  return read(session, '/api/v1/search?' + query, browserSearchV1, signal);
}
