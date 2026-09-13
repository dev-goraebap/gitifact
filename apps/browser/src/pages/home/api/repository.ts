import { queryOptions } from '@tanstack/react-query';
import { browserSessionV1, browserHttpErrorV1, repositoryStatusV1 } from '@tryce/contracts';
import type { BrowserSessionV1, RepositoryStatusSuccessV1 } from '@tryce/contracts';
import { ApiError, requestJson } from '../../../shared/api/client';

export const sessionKey = ['browser-session', 1, window.location.origin] as const;
function httpFailure(data: unknown): never {
  const parsed = browserHttpErrorV1.safeParse(data);
  if (parsed.success) throw new ApiError(parsed.data.error.message, parsed.data.error.code);
  throw new ApiError('서버 응답이 지원하는 계약과 일치하지 않습니다.', 'INVALID_RESPONSE');
}
export const sessionOptions = () => queryOptions({
  queryKey: sessionKey,
  staleTime: 0,
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: true,
  queryFn: async ({ signal }) => {
    const { response, data } = await requestJson('/api/v1/session', { signal });
    if (!response.ok) return httpFailure(data);
    const parsed = browserSessionV1.safeParse(data);
    if (!parsed.success) throw new ApiError('서버 세션 형식이 호환되지 않습니다.', 'INVALID_RESPONSE');
    return parsed.data;
  },
});
export function statusKey(session: BrowserSessionV1) {
  return ['repository-status', 1, window.location.origin, session.sessionId, session.repository.key, session.repository.worktreeKey] as const;
}
async function fetchStatus(session: BrowserSessionV1, refresh: boolean, signal?: AbortSignal): Promise<RepositoryStatusSuccessV1> {
  const { response, data } = await requestJson('/api/v1/status' + (refresh ? '/refresh' : ''), {
    method: refresh ? 'POST' : 'GET',
    headers: { 'X-Tryce-Session': session.sessionId },
    ...(signal ? { signal } : {}),
  });
  const result = repositoryStatusV1.safeParse(data);
  if (!result.success) return httpFailure(data);
  if (!result.data.ok) throw new ApiError(result.data.error.message, result.data.error.code);
  if (!response.ok) throw new ApiError('서버 상태와 응답 결과가 일치하지 않습니다.', 'INVALID_RESPONSE');
  if (result.data.repository.key !== session.repository.key || result.data.repository.worktreeKey !== session.repository.worktreeKey) {
    throw new ApiError('다른 checkout의 응답입니다. 다시 연결하세요.', 'SESSION_CHANGED');
  }
  return result.data;
}
export const statusOptions = (session: BrowserSessionV1) => queryOptions({
  queryKey: statusKey(session),
  staleTime: 5000,
  retry: false,
  queryFn: ({ signal }) => fetchStatus(session, false, signal),
});
export const refreshStatus = (session: BrowserSessionV1) => fetchStatus(session, true);
