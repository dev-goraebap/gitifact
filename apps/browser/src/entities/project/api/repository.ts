import { queryOptions } from '@tanstack/react-query';
import { browserSessionV2, browserHttpErrorV1, repositoryStatusV1 } from '@gitifact/contracts';
import type { BrowserSessionV2, RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { ApiError, requestJson } from '../../../shared/api/client';
import { t } from '../../../shared/i18n';

const updatePollLimit = 8;
export const sessionKey = ['browser-session', 2, window.location.origin] as const;
export function httpFailure(data: unknown): never {
  const parsed = browserHttpErrorV1.safeParse(data);
  if (parsed.success) throw new ApiError(parsed.data.error.message, parsed.data.error.code);
  throw new ApiError(t('api.invalidContract'), 'INVALID_RESPONSE');
}
// Explicit generics: the refetchInterval callback reads the data, which otherwise makes its type circular.
export const sessionOptions = () =>
  queryOptions<BrowserSessionV2, Error, BrowserSessionV2, typeof sessionKey>({
    queryKey: sessionKey,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    // The server checks the registry once in the background. While that is pending the session is re-read a bounded
    // number of times; re-reading never causes another registry request.
    refetchInterval: query => (query.state.data?.update.status === 'checking' && query.state.dataUpdateCount < updatePollLimit ? 1000 : false),
    queryFn: async ({ signal }): Promise<BrowserSessionV2> => {
      const { response, data } = await requestJson('/api/v1/session', { signal });
      if (!response.ok) return httpFailure(data);
      const parsed = browserSessionV2.safeParse(data);
      if (!parsed.success) throw new ApiError(t('api.invalidSession'), 'INVALID_RESPONSE');
      return parsed.data;
    },
  });
export function statusKey(session: BrowserSessionV2) {
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
  session: BrowserSessionV2,
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
export const statusOptions = (session: BrowserSessionV2) =>
  queryOptions({
    queryKey: statusKey(session),
    staleTime: 5000,
    retry: false,
    queryFn: ({ signal }) => fetchStatus(session, false, signal),
  });
export const refreshStatus = (session: BrowserSessionV2) => fetchStatus(session, true);
