import type { QueryClient } from '@tanstack/react-query';
import { historyOptions, primeFrame, settle, workingOptions, type HistoryFilter } from '../../../entities/project';
import type { RecordSearch } from '../../../widgets/records-page';

/** The history the address asks for. The route's loader and the timeline build it the same way. */
export const historyFilterOf = (search: RecordSearch): HistoryFilter =>
  ({ kind: search.kind, document: search.document, feature: search.feature, author: search.author, q: search.q });

/** Primes the records list: the frame, the first commits the address asks for, and the uncommitted work shown first. */
export async function loadRecords(client: QueryClient, search: RecordSearch) {
  const { session, checkout } = await primeFrame(client);
  if (!session) return;
  await Promise.all([
    checkout?.head ? settle(client.ensureInfiniteQueryData(historyOptions(session, checkout.head, historyFilterOf(search)))) : undefined,
    settle(client.ensureQueryData(workingOptions(session))),
  ]);
}
