import { infiniteQueryOptions } from '@tanstack/react-query';
import { browserSpecsV1, type BrowserSessionV2 } from '@gitifact/contracts';
import { requestJson, ApiError } from '../../../shared/api/client';
import { httpFailure } from './repository';
import { t } from '../../../shared/i18n';
export const specsOptions = (session: BrowserSessionV2) => infiniteQueryOptions({
  queryKey: ['browser-specs', 1, window.location.origin, session.sessionId, session.repository.worktreeKey],
  initialPageParam: { cursor: 0, head: '' }, staleTime: 5000, retry: false,
  queryFn: async ({ signal, pageParam }) => {
    const suffix = pageParam.cursor ? `?cursor=${pageParam.cursor}&head=${pageParam.head}` : '';
    const { response, data } = await requestJson('/api/v1/specs' + suffix, {signal, headers:{'X-Gitifact-Session': session.sessionId}});
    if (!response.ok) return httpFailure(data);
    const parsed = browserSpecsV1.safeParse(data);
    if (!parsed.success) throw new ApiError(t('api.invalidSpecs'), 'INVALID_RESPONSE');
    if (parsed.data.sessionId !== session.sessionId) throw new ApiError(t('api.serverChanged'), 'SESSION_CHANGED');
    return parsed.data;
  },
  getNextPageParam: last => last.nextCursor === null ? undefined : { cursor: last.nextCursor, head: last.head ?? '' },
});
