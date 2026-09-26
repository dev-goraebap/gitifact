import type { QueryClient } from '@tanstack/react-query';
import { contributorOptions, contributorsOptions, historyOptions, primeFrame, settle } from '../../../entities/project';
import type { RecordSearch } from '../../../widgets/records-page';

/** How many of a person's newest changes their page lists. */
export const RECENT_CHANGES = 10;

/** Primes the contributors screens: the frame, then the cards the address asks for, or one person and their newest changes. */
export async function loadContributors(client: QueryClient, email: string | undefined, search: RecordSearch) {
  const { session, checkout } = await primeFrame(client);
  if (!session) return;
  if (!email) { await settle(client.ensureInfiniteQueryData(contributorsOptions(session, search.q))); return; }
  const answer = await client.ensureQueryData(contributorOptions(session, email)).catch(() => undefined);
  if (answer && checkout?.head) await settle(client.ensureInfiniteQueryData(historyOptions(session, checkout.head, { author: answer.person.email }, RECENT_CHANGES)));
}
