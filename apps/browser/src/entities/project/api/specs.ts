import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { browserSpecsV7, browserHistoryV6, browserHistorySummaryV4, browserSearchV2, browserCommitFilesV2, browserCommitFileV1, browserCommitV4, browserCommitChangeV1, browserInstructionFileV1,
  browserRecordV1, browserStampV1, browserWorkingV1, browserWorkingChangeV1, type BrowserSessionV3 } from '@gitifact/contracts';
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
 * The checkout — current specs, instructions and contributors — read once and kept until the reader asks again. Every screen
 * that shows specs shares it, and the header's refresh button is how this project says an observation is explicit.
 */
export const specsOptions = (session: BrowserSessionV3) => queryOptions({
  queryKey: ['browser-specs', 7, ...scope(session)],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/specs', browserSpecsV7, signal),
});

/**
 * A fingerprint of HEAD and the uncommitted documents, asked for when the reader comes back to the tab. Never kept:
 * each question is a new answer, compared with the stamp the checkout was read at.
 */
export const stampOptions = (session: BrowserSessionV3) => queryOptions({
  queryKey: ['browser-stamp', 1, ...scope(session)],
  staleTime: 0, gcTime: 0, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/stamp', browserStampV1, signal),
});

/** What is not committed yet: records and changed documents. Worked out anew by the server; kept like the checkout. */
export const workingOptions = (session: BrowserSessionV3) => queryOptions({
  queryKey: ['browser-working', 1, ...scope(session)],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/working', browserWorkingV1, signal),
});

/** One uncommitted change with the document at HEAD and as the file is now, read when the reader opens it. */
export const workingChangeOptions = (session: BrowserSessionV3, id: string) => queryOptions({
  queryKey: ['browser-working-change', 1, ...scope(session), id],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/working/change?id=' + encodeURIComponent(id), browserWorkingChangeV1, signal),
});

/**
 * Changes of `head`'s history that match the filters, twenty commits at a time, each commit whole. The server filters
 * and counts over all of history, so a filter finds what was never loaded and `total` is the whole count. Each page
 * starts after the last commit of the one before. A HEAD's history never changes, so its pages are kept for the session.
 */
export const historyOptions = (session: BrowserSessionV3, head: string, filter: HistoryFilter, limit = 20) => infiniteQueryOptions({
  queryKey: ['browser-history', 6, ...scope(session), head, filter, limit],
  initialPageParam: undefined as string | undefined, staleTime: Infinity, retry: false,
  queryFn: ({ signal, pageParam }) => {
    const query = new URLSearchParams({ head, limit: String(limit) });
    if (pageParam) query.set('after', pageParam);
    for (const [key, value] of Object.entries(filter)) if (value) query.set(key, value);
    return read(session, '/api/v1/history?' + query, browserHistoryV6, signal);
  },
  getNextPageParam: last => last.next ?? undefined,
});

/** Counts over all of `head`'s history and its newest commits, for the overview. */
export const summaryOptions = (session: BrowserSessionV3, head: string) => queryOptions({
  queryKey: ['browser-history-summary', 3, ...scope(session), head],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/history/summary?head=' + head, browserHistorySummaryV4, signal),
});

/**
 * One commit and the documents it changed, twenty at a time and without their text: what its page lists. `limit`
 * reads more at once, as the record page does to find every document its record explains. A commit never changes.
 */
export const commitOptions = (session: BrowserSessionV3, commit: string, limit = 20) => infiniteQueryOptions({
  queryKey: ['browser-commit', 4, ...scope(session), commit, limit],
  initialPageParam: undefined as string | undefined, staleTime: Infinity, retry: false,
  queryFn: ({ signal, pageParam }) => {
    const query = new URLSearchParams({ commit, limit: String(limit) });
    if (pageParam) query.set('after', pageParam);
    return read(session, '/api/v1/commit?' + query, browserCommitV4, signal);
  },
  getNextPageParam: last => last.next ?? undefined,
});

/** One document a commit changed with the text on both sides, read from Git when the reader opens it. */
export const commitChangeOptions = (session: BrowserSessionV3, commit: string, id: string) => queryOptions({
  queryKey: ['browser-commit-change', 1, ...scope(session), commit, id],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/commit/change?' + new URLSearchParams({ commit, id }), browserCommitChangeV1, signal),
});

/** Which commit of `head` added a record. History of one HEAD never changes, so the answer is kept. */
export const recordOptions = (session: BrowserSessionV3, head: string, id: string) => queryOptions({
  queryKey: ['browser-record', 1, ...scope(session), head, id],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/record?head=' + head + '&id=' + encodeURIComponent(id), browserRecordV1, signal),
});

/**
 * The source files a commit changed beside its documents, twenty at a time; each page starts after the last file of
 * the one before. A commit never changes, so the pages are kept.
 */
export const commitFilesOptions = (session: BrowserSessionV3, commit: string) => infiniteQueryOptions({
  queryKey: ['browser-commit-files', 2, ...scope(session), commit],
  initialPageParam: undefined as string | undefined, staleTime: Infinity, retry: false,
  queryFn: ({ signal, pageParam }) => {
    const query = new URLSearchParams({ commit });
    if (pageParam) query.set('after', pageParam);
    return read(session, '/api/v1/commit/files?' + query, browserCommitFilesV2, signal);
  },
  getNextPageParam: last => last.next ?? undefined,
});

/** One of those files on both sides, read when the reader opens it. */
export const commitFileOptions = (session: BrowserSessionV3, commit: string, path: string) => queryOptions({
  queryKey: ['browser-commit-file', 1, ...scope(session), commit, path],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/commit/file?' + new URLSearchParams({ commit, path }), browserCommitFileV1, signal),
});

/**
 * One file of an instruction folder from the working tree, read when the reader opens it. Kept like the checkout: the header's
 * refresh reads the checkout again, and a file whose size changed there is a new query.
 */
export const instructionFileOptions = (session: BrowserSessionV3, id: string, path: string, size: number) => queryOptions({
  queryKey: ['browser-instruction-file', 1, ...scope(session), id, path, size],
  staleTime: Infinity, retry: false,
  queryFn: ({ signal }) => read(session, '/api/v1/instructions/file?' + new URLSearchParams({ id, path }), browserInstructionFileV1, signal),
});

/** Records whose title, place or text holds the words: the current specs and instructions, then past changes of `head`. */
export function searchRecords(session: BrowserSessionV3, words: string, head: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ q: words }); if (head) query.set('head', head);
  return read(session, '/api/v1/search?' + query, browserSearchV2, signal);
}
