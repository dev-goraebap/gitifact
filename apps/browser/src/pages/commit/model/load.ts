import type { QueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { commitChangeOptions, commitFilesOptions, commitNamedOptions, commitOptions, primeFrame, recordOptions, settle, workingChangeOptions, workingOptions } from '../../../entities/project';
import { prepareDiagrams } from '../../../shared/ui/document';
import { isCommitStart, isWholeCommit } from './commit-address';

/** The document a list opens on: the one the address names in its fragment, or the first. */
const openedOf = (ids: string[], hash: string) => { const named = decodeURIComponent(hash); return ids.includes(named) ? named : ids[0]; };

/** Primes the text of the document a commit's list opens on, with its diagrams drawn. */
async function primeCommitDocument(client: QueryClient, session: BrowserSessionV3, commit: string, ids: string[], hash: string) {
  const id = openedOf(ids, hash);
  if (!id) return;
  const change = await client.ensureQueryData(commitChangeOptions(session, commit, id)).catch(() => undefined);
  if (change) await prepareDiagrams([change.before?.body, change.after?.body]);
}

/**
 * The whole hash an address's commit stands for: itself when whole, the one commit of HEAD a hash's start names, or
 * nothing when the start names no commit or several.
 */
export async function wholeCommitOf(client: QueryClient, commit: string): Promise<string | undefined> {
  if (isWholeCommit(commit)) return commit;
  if (!isCommitStart(commit)) return undefined;
  const { session } = await primeFrame(client);
  if (!session) return undefined;
  return await client.ensureQueryData(commitNamedOptions(session, commit.toLowerCase())).catch(() => null) ?? undefined;
}

/** Primes a commit's page: the frame, its first documents and source files, and the document its documents tab opens on. */
export async function loadCommit(client: QueryClient, commit: string, tab: string | undefined, hash: string) {
  const { session } = await primeFrame(client);
  // An address no whole hash stood for draws its not-found state and asks nothing.
  if (!session || !isWholeCommit(commit)) return;
  const [documents] = await Promise.all([
    client.ensureInfiniteQueryData(commitOptions(session, commit)).catch(() => undefined),
    settle(client.ensureInfiniteQueryData(commitFilesOptions(session, commit))),
  ]);
  const first = documents?.pages[0];
  if (!first) return;
  // The tab rule of the page: documents when the address names one or the commit added no records.
  const opened = tab ?? (hash || !first.changes.some(c => c.records.length) ? 'documents' : 'records');
  if (opened === 'documents') await primeCommitDocument(client, session, commit, first.changes.map(c => c.id), hash);
}

/**
 * Primes a record's page: the frame, the record in HEAD's history, the documents it explains in its commit and the one
 * its list opens on. A record HEAD's history lacks may be one not committed yet, which the page finds in the uncommitted work.
 */
export async function loadRecord(client: QueryClient, recordId: string, hash: string) {
  const { session, checkout } = await primeFrame(client);
  if (!session || !checkout?.head) return;
  const found = await client.ensureQueryData(recordOptions(session, checkout.head, recordId)).catch(() => undefined);
  if (!found) { await settle(client.ensureQueryData(workingOptions(session))); return; }
  const documents = await client.ensureInfiniteQueryData(commitOptions(session, found.commit, recordId)).catch(() => undefined);
  const first = documents?.pages[0];
  if (first) await primeCommitDocument(client, session, found.commit, first.changes.map(c => c.id), hash);
}

/** Primes the uncommitted work's page: the frame, the work, and the document its documents tab opens on. */
export async function loadWorking(client: QueryClient, tab: string | undefined, hash: string) {
  const { session } = await primeFrame(client);
  if (!session) return;
  const work = await client.ensureQueryData(workingOptions(session)).catch(() => undefined);
  if (!work || (tab ?? (hash || !work.records.length ? 'documents' : 'records')) !== 'documents') return;
  const id = openedOf(work.changes.map(c => c.id), hash);
  const change = id ? await client.ensureQueryData(workingChangeOptions(session, id)).catch(() => undefined) : undefined;
  if (change) await prepareDiagrams([change.before?.body, change.after?.body]);
}
