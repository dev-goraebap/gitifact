import { randomUUID } from 'node:crypto';
import { RepositoryReadError } from '@tryce/core';
import { browserSessionV1 } from '@tryce/contracts';
import type { RepositoryStatusSuccessV1, RepositoryStatusFailureV1 } from '@tryce/contracts';
import { failureDto } from '../output/repository-status.js';

type Result = RepositoryStatusSuccessV1 | RepositoryStatusFailureV1;
export function createStatusSession(initial: RepositoryStatusSuccessV1, read: () => Promise<RepositoryStatusSuccessV1>) {
  const session = browserSessionV1.parse({
    contract: 'browser-session', version: 1, sessionId: randomUUID(),
    repository: { key: initial.repository.key, worktreeKey: initial.repository.worktreeKey },
  });
  let latest: Result = initial;
  let pending: Promise<Result> | undefined;
  return {
    session,
    get latest() { return latest; },
    get pending() { return pending; },
    refresh(): Promise<Result> {
      if (pending) return pending;
      pending = (async () => {
        try {
          const next = await read();
          if (next.repository.key !== session.repository.key || next.repository.worktreeKey !== session.repository.worktreeKey) {
            throw new RepositoryReadError('REPOSITORY_CHANGED');
          }
          latest = next;
        } catch (error) { latest = failureDto(error); }
        return latest;
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}
