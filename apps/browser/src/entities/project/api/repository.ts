import { queryOptions } from '@tanstack/react-query';
import { browserSessionV3, browserHttpErrorV1, repositoryStatusV1 } from '@gitifact/contracts';
import type { BrowserSessionV3, RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { ApiError, requestJson } from '../../../shared/api/client';
import { t } from '../../../shared/i18n';

export const sessionKey = ['browser-session', 3, window.location.origin] as const;
export function httpFailure(data: unknown): never {
  const parsed = browserHttpErrorV1.safeParse(data);
  if (parsed.success) throw new ApiError(parsed.data.error.message, parsed.data.error.code);
  throw new ApiError(t('api.invalidContract'), 'INVALID_RESPONSE');
}
export const sessionOptions = () =>
  queryOptions<BrowserSessionV3, Error, BrowserSessionV3, typeof sessionKey>({
    queryKey: sessionKey,
    // Asked again whenever a screen mounts, but kept between: a route's loader reads it before the screen that uses it exists.
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }): Promise<BrowserSessionV3> => {
      const { response, data } = await requestJson('/api/v1/session', { signal });
      if (!response.ok) return httpFailure(data);
      const parsed = browserSessionV3.safeParse(data);
      if (!parsed.success) throw new ApiError(t('api.invalidSession'), 'INVALID_RESPONSE');
      return parsed.data;
    },
  });
export function statusKey(session: BrowserSessionV3) {
  return [
    'repository-status',
    1,
    window.location.origin,
    session.sessionId,
    session.repository.key,
    session.repository.worktreeKey,
  ] as const;
}
async function fetchStatus(
  session: BrowserSessionV3,
  refresh: boolean,
  signal?: AbortSignal,
): Promise<RepositoryStatusSuccessV1> {
  const { response, data } = await requestJson('/api/v1/status' + (refresh ? '/refresh' : ''), {
    method: refresh ? 'POST' : 'GET',
    headers: { 'X-Gitifact-Session': session.sessionId },
    ...(signal ? { signal } : {}),
  });
  const result = repositoryStatusV1.safeParse(data);
  if (!result.success) return httpFailure(data);
  if (!result.data.ok) throw new ApiError(result.data.error.message, result.data.error.code);
  if (!response.ok) throw new ApiError(t('api.statusMismatch'), 'INVALID_RESPONSE');
  if (
    result.data.repository.key !== session.repository.key ||
    result.data.repository.worktreeKey !== session.repository.worktreeKey
  ) {
    throw new ApiError(t('api.otherCheckout'), 'SESSION_CHANGED');
  }
  return result.data;
}
export const statusOptions = (session: BrowserSessionV3) =>
  queryOptions({
    queryKey: statusKey(session),
    staleTime: 5000,
    retry: false,
    queryFn: ({ signal }) => fetchStatus(session, false, signal),
  });
export const refreshStatus = (session: BrowserSessionV3) => fetchStatus(session, true);
