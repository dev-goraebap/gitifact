import { infiniteQueryOptions } from '@tanstack/react-query';
import { browserSpecsV1, type BrowserSessionV1 } from '@tryce/contracts';
import { requestJson, ApiError } from '../../../shared/api/client';
import { httpFailure } from './repository';
export const specsOptions = (session: BrowserSessionV1) => infiniteQueryOptions({
  queryKey: ['browser-specs', 1, window.location.origin, session.sessionId, session.repository.worktreeKey],
  initialPageParam: { cursor: 0, head: '' }, staleTime: 5000, retry: false,
  queryFn: async ({ signal, pageParam }) => {
    const suffix = pageParam.cursor ? `?cursor=${pageParam.cursor}&head=${pageParam.head}` : '';
    const { response, data } = await requestJson('/api/v1/specs' + suffix, {signal, headers:{'X-Tryce-Session': session.sessionId}});
    if (!response.ok) return httpFailure(data);
    const parsed = browserSpecsV1.safeParse(data);
    if (!parsed.success) throw new ApiError('명세 응답 형식이 호환되지 않습니다.', 'INVALID_RESPONSE');
    if (parsed.data.sessionId !== session.sessionId) throw new ApiError('서버가 변경됐습니다. 다시 연결하세요.', 'SESSION_CHANGED');
    return parsed.data;
  },
  getNextPageParam: last => last.nextCursor === null ? undefined : { cursor: last.nextCursor, head: last.head ?? '' },
});
