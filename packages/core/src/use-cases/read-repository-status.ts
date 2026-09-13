import { summarizeChanges } from '../domain/repository-status.js';
import type { RepositoryReader } from '../ports/repository-reader.js';

export async function readRepositoryStatus(
  reader: RepositoryReader,
  services: { now: () => string; newId: () => string },
) {
  const startedAt = services.now();
  const state = await reader.read();
  return {
    ...state,
    observation: {
      id: services.newId(),
      startedAt,
      completedAt: services.now(),
      consistency: 'best-effort' as const,
    },
    summary: summarizeChanges(state.changes),
  };
}
export type RepositoryObservation = Awaited<ReturnType<typeof readRepositoryStatus>>;
