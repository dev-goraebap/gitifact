import type { QueryClient } from '@tanstack/react-query';
import { sessionOptions, settle, statusOptions } from '../../../entities/project';

/** Primes the Git page: the session and the repository status it shows. */
export async function loadGitStatus(client: QueryClient) {
  const session = await client.ensureQueryData(sessionOptions()).catch(() => undefined);
  if (session) await settle(client.ensureQueryData(statusOptions(session)));
}
