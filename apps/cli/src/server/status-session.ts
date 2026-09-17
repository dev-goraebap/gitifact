import { randomUUID } from 'node:crypto';
import { RepositoryReadError } from '@gitifact/core';
import { browserSessionV2 } from '@gitifact/contracts';
import type { RepositoryStatusSuccessV1, RepositoryStatusFailureV1, UpdateStateV1 } from '@gitifact/contracts';
import { failureDto } from '../output/repository-status.js';
import { disabledUpdate } from '../shared/update-check.js';

type Result = RepositoryStatusSuccessV1 | RepositoryStatusFailureV1;
export function createStatusSession(initial: RepositoryStatusSuccessV1, read: () => Promise<RepositoryStatusSuccessV1>, cliVersion = '0.0.0') {
  const identity = { sessionId: randomUUID(), repository: { key: initial.repository.key, worktreeKey: initial.repository.worktreeKey } };
  let update: UpdateStateV1 = disabledUpdate;
  let latest: Result = initial;
  let pending: Promise<Result> | undefined;
  return {
    // The identity never changes; only the update state moves (checking → a final state), so the session is built per read.
    get session() { return browserSessionV2.parse({ contract: 'browser-session', version: 2, ...identity, cliVersion, update }); },
    setUpdate(next: UpdateStateV1) { update = next; },
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
