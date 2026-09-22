import { RepositoryReadError } from '@gitifact/core';
import type { RepositoryObservation } from '@gitifact/core';
import { repositoryStatusFailureV1, repositoryStatusSuccessV1 } from '@gitifact/contracts';

export function statusDto(observation: RepositoryObservation) {
  return repositoryStatusSuccessV1.parse({
    contract: 'repository-status', version: 1, ok: true,
    observation: { ...observation.observation },
    repository: { ...observation.repository },
    head: { ...observation.head },
    changes: observation.changes.map((change) => ({ ...change })),
    summary: { ...observation.summary },
    checks: { state: 'not-run', reason: 'git-status-only' },
  });
}
export function failureDto(error: unknown) {
  const known = error instanceof RepositoryReadError ? error : new RepositoryReadError('GIT_FAILED');
  return repositoryStatusFailureV1.parse({
    contract: 'repository-status', version: 1, ok: false,
    error: { code: known.code, message: known.message },
  });
}
