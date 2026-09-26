import type { QueryClient } from '@tanstack/react-query';
import { changelogOptions, sessionOptions, settle } from '../../../entities/project';
import { getLanguage } from '../../../shared/i18n';

/** Primes the release notes in the language on screen. */
export async function loadChangelog(client: QueryClient) {
  const session = await client.ensureQueryData(sessionOptions()).catch(() => undefined);
  if (session) await settle(client.ensureQueryData(changelogOptions(session, getLanguage())));
}
