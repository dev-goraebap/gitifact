import type { DocKind, RecordSectionKey } from '@gitifact/core';

/** One document at one side of a change: everything the detail shows. */
export interface DocSnapshot {
  id: string; kind: DocKind; title: string; description: string; body: string; specId: string; path: string;
  order?: number; requirements?: string[]; sources?: SnapshotSource[];
}
/** A design source as the detail shows it: by ID in the current format, by title and path or URL in 0.7. */
export interface SnapshotSource { id?: string; title?: string; path?: string; url?: string; note?: string }
export type ChangeType = 'created' | 'modified' | 'moved' | 'deleted';
/**
 * A record as the history shows it: the commit that added it says who and when. Reasons from before records (the
 * reason file of past commits, 0.7 history) read as records with only a context, titled by their first sentence.
 */
export interface EventRecord { id: string; title: string; sections: { key: RecordSectionKey; body: string }[] }
/**
 * One change of one commit, with the full text on both sides. Lists send it without the text. `source` names the commits
 * each side was read at, so the cache keeps only where the text is and reads it from Git again; 0.7 history has none.
 */
export interface HistoryEvent {
  key: string; commit: string; date: string; author: string; email: string; committer: string; message: string;
  id: string; kind: DocKind; types: ChangeType[]; before: DocSnapshot | null; after: DocSnapshot | null; records: EventRecord[];
  source?: { before: string | null; after: string };
}
export interface CommitChanges { commit: string; events: HistoryEvent[] }
