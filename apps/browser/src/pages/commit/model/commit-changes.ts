import { useQuery, type UseInfiniteQueryResult, type InfiniteData } from '@tanstack/react-query';
import type { BrowserCommitV4, BrowserSessionV3, SpecEvent } from '@gitifact/contracts';
import { commitChangeOptions } from '../../../entities/project';
import type { ListedChange } from '../ui/ChangeBody';
import type { UseChange } from '../ui/RecordDocuments';

/** A change of a commit as a list names it: its title from whichever side it has. */
export const listed = (event: SpecEvent): ListedChange =>
  ({ key: event.key, id: event.id, kind: event.kind, types: event.types, title: (event.after ?? event.before)?.title ?? event.id });

/** The pages of a commit read so far, as one commit: its head from the first page and every change loaded. */
export function loadedCommit(query: UseInfiniteQueryResult<InfiniteData<BrowserCommitV4>, Error>) {
  const pages = query.data?.pages;
  const first = pages?.[0];
  return first ? { ...first, changes: pages!.flatMap(p => p.changes) } : undefined;
}

/** The hook the document list reads a commit's document with: its text on both sides, from Git, when it is opened. */
export const commitChange = (session: BrowserSessionV3, commit: string): UseChange => function useCommitChange(id: string) {
  return useQuery(commitChangeOptions(session, commit, id));
};
