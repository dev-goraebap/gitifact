import { randomUUID } from 'node:crypto';
import { RepositoryReadError } from '@gitifact/core';
import { browserSessionV3 } from '@gitifact/contracts';
import type { RepositoryStatusSuccessV1, RepositoryStatusFailureV1 } from '@gitifact/contracts';
import { failureDto } from '../output/repository-status.js';

type Result = RepositoryStatusSuccessV1 | RepositoryStatusFailureV1;
export function createStatusSession(initial: RepositoryStatusSuccessV1, read: () => Promise<RepositoryStatusSuccessV1>, cliVersion = '0.0.0') {
  const identity = { sessionId: randomUUID(), repository: { key: initial.repository.key, worktreeKey: initial.repository.worktreeKey } };
  const session = browserSessionV3.parse({ contract: 'browser-session', version: 3, ...identity, cliVersion });
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
          if (next.repository.key !== identity.repository.key || next.repository.worktreeKey !== identity.repository.worktreeKey) {
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
