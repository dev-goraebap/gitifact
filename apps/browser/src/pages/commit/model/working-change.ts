import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, WorkingChange } from '@gitifact/contracts';
import { workingChangeOptions } from '../../../entities/project';
import type { Change, ListedChange } from '../ui/ChangeBody';
import type { UseChange } from '../ui/RecordDocuments';

/** An uncommitted change as the document list names it; it has no commit, so its document ID is its key. */
export const listedWorking = (change: WorkingChange): ListedChange => ({ key: change.id, id: change.id, kind: change.kind, types: change.types, title: change.title });

/** The hook the document list reads an uncommitted document with: the document at HEAD and the file as it is now. */
export const workingChange = (session: BrowserSessionV3): UseChange => function useWorkingChange(id: string) {
  const query = useQuery(workingChangeOptions(session, id));
  const data: Change | undefined = query.data && { event: listedWorking(query.data.change), before: query.data.before, after: query.data.after };
  return { data, error: query.error, refetch: query.refetch };
};
