import { queryOptions } from '@tanstack/react-query';
import { browserProjectV1, type BrowserSessionV1 } from '@tryce/contracts';
import { ApiError, requestJson } from '../../../shared/api/client';
import { httpFailure } from './repository';
export const projectOptions = (session: BrowserSessionV1) =>
  queryOptions({
    queryKey: [
      'browser-project',
      1,
      window.location.origin,
      session.sessionId,
      session.repository.key,
      session.repository.worktreeKey,
    ],
    staleTime: 5000,
    retry: false,
    queryFn: async ({ signal }) => {
      const { response, data } = await requestJson('/api/v1/project', {
        signal,
        headers: { 'X-Tryce-Session': session.sessionId },
      });
      if (!response.ok) return httpFailure(data);
      const parsed = browserProjectV1.safeParse(data);
      if (!parsed.success) throw new ApiError('프로젝트 응답 형식이 호환되지 않습니다.', 'INVALID_RESPONSE');
      const report = parsed.data.brief.report;
      if (
        report &&
        (report.repository.key !== session.repository.key ||
          report.repository.worktreeKey !== session.repository.worktreeKey)
      ) {
        throw new ApiError('다른 checkout의 응답입니다. 다시 연결하세요.', 'SESSION_CHANGED');
      }
      return parsed.data;
    },
  });
