import { queryOptions } from '@tanstack/react-query';
import { changelogV1, type BrowserSessionV2 } from '@gitifact/contracts';
import { requestJson, ApiError } from '../../../shared/api/client';
import { httpFailure } from './repository';
import { t, type Language } from '../../../shared/i18n';

// Release notes ship with the CLI, so they change only when the server does; the session id scopes the cache.
export const changelogOptions = (session: BrowserSessionV2, language: Language) => queryOptions({
  queryKey: ['changelog', 1, window.location.origin, session.sessionId, language],
  staleTime: Infinity, retry: false,
  queryFn: async ({ signal }) => {
    const { response, data } = await requestJson('/api/v1/changelog?lang=' + language, { signal, headers: { 'X-Gitifact-Session': session.sessionId } });
    if (!response.ok) return httpFailure(data);
    const parsed = changelogV1.safeParse(data);
    if (!parsed.success) throw new ApiError(t('api.invalidChangelog'), 'INVALID_RESPONSE');
    return parsed.data;
  },
});
