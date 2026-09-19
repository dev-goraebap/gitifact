import { infiniteQueryOptions } from '@tanstack/react-query';
import { browserSpecsV3, browserSpecsFirstV3, type BrowserSpecsV3, type BrowserSpecsFirstV3, type BrowserSessionV2 } from '@gitifact/contracts';
import { requestJson, ApiError } from '../../../shared/api/client';
import { httpFailure } from './repository';
import { t } from '../../../shared/i18n';

/**
 * The specs answer is read once and then kept until the reader asks for it again. Every screen that shows specs
 * shares this query, so a stale time of seconds meant that moving between them refetched every page loaded so far:
 * after three "load more" presses, returning to the activity screen spent two seconds re-reading history that had
 * not changed. The header's refresh button is how this project already says the observation is explicit, so the
 * cached answer stands until it is pressed.
 */
export const specsOptions = (session: BrowserSessionV2) => infiniteQueryOptions({
  queryKey: ['browser-specs', 3, window.location.origin, session.sessionId, session.repository.worktreeKey],
  initialPageParam: { cursor: 0, head: '' }, staleTime: Infinity, retry: false,
  queryFn: async ({ signal, pageParam }) => {
    const suffix = pageParam.cursor ? `?cursor=${pageParam.cursor}&head=${pageParam.head}` : '';
    const { response, data } = await requestJson('/api/v1/specs' + suffix, {signal, headers:{'X-Gitifact-Session': session.sessionId}});
    if (!response.ok) return httpFailure(data);
    // The first page must carry the checkout; a continuation page carries only its commits.
    const parsed = (pageParam.cursor ? browserSpecsV3 : browserSpecsFirstV3).safeParse(data);
    if (!parsed.success) throw new ApiError(t('api.invalidSpecs'), 'INVALID_RESPONSE');
    if (parsed.data.sessionId !== session.sessionId) throw new ApiError(t('api.serverChanged'), 'SESSION_CHANGED');
    return parsed.data as BrowserSpecsV3;
  },
  getNextPageParam: last => last.nextCursor === null ? undefined : { cursor: last.nextCursor, head: last.head ?? '' },
});

/** The checkout as the first page reported it; pages after it describe history only. */
export function checkoutOf(pages: BrowserSpecsV3[] | undefined): BrowserSpecsFirstV3 | undefined {
  const first = pages?.[0];
  return first && first.features !== undefined ? first as BrowserSpecsFirstV3 : undefined;
}
