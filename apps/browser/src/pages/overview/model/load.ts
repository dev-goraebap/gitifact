import type { QueryClient } from '@tanstack/react-query';
import { primeFrame, settle, statusOptions, summaryOptions } from '../../../entities/project';

/** Primes the dashboard: the frame, the counts over history and the repository status that names the project. */
export async function loadOverview(client: QueryClient) {
  const { session, checkout } = await primeFrame(client);
  if (!session) return;
  await Promise.all([
    checkout?.head ? settle(client.ensureQueryData(summaryOptions(session, checkout.head))) : undefined,
    settle(client.ensureQueryData(statusOptions(session))),
  ]);
}
