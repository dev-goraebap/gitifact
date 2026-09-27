import type { QueryClient } from '@tanstack/react-query';
import { documentHistoryOptions, primeFrame } from '../../../entities/project';

/** Primes a document's history: the frame, then the first twenty commits that changed it in the HEAD the reader is on. */
export async function loadDocumentHistory(client: QueryClient, id: string) {
  const { session, checkout } = await primeFrame(client);
  if (!session || !checkout?.head) return;
  await client.ensureInfiniteQueryData(documentHistoryOptions(session, checkout.head, id)).catch(() => undefined);
}
