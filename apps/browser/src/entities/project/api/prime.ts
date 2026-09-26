import type { QueryClient } from '@tanstack/react-query';
import type { BrowserCheckoutV1, BrowserSessionV3 } from '@gitifact/contracts';
import { sessionOptions } from './repository';
import { checkoutOptions } from './specs';

/**
 * Waits for a read a route's loader primes, keeping a failure in the cache instead of failing the navigation: the screen
 * reads the same query and shows its own error or "not found" there, with its own way to try again.
 */
export const settle = (read: Promise<unknown>) => read.then(() => undefined, () => undefined);

/**
 * The frame every records screen is drawn over, primed before the screen is: the server session, then the checkout's
 * frame (HEAD, the index). Undefined parts are reads that failed; the screen shows why.
 */
export async function primeFrame(client: QueryClient): Promise<{ session?: BrowserSessionV3; checkout?: BrowserCheckoutV1 }> {
  const session = await client.ensureQueryData(sessionOptions()).catch(() => undefined);
  if (!session) return {};
  const checkout = await client.ensureQueryData(checkoutOptions(session)).catch(() => undefined);
  return checkout ? { session, checkout } : { session };
}
