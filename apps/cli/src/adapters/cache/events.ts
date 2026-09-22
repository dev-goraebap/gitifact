import type { DocKind } from '@gitifact/core';

/** One document at one side of a change: everything the detail shows. */
export interface DocSnapshot {
  id: string; kind: DocKind; title: string; description: string; body: string; specId: string; path: string;
  order?: number; requirements?: string[]; sources?: SnapshotSource[];
}
/** A design source as the detail shows it: by ID in the current format, by title and path or URL in 0.7. */
export interface SnapshotSource { id?: string; title?: string; path?: string; url?: string; note?: string }
export type ChangeType = 'created' | 'modified' | 'moved' | 'deleted';
/** One change of one commit, with the full text on both sides. Lists send it without the text. */
export interface HistoryEvent {
  key: string; commit: string; date: string; author: string; email: string; committer: string; message: string;
  id: string; kind: DocKind; types: ChangeType[]; before: DocSnapshot | null; after: DocSnapshot | null; reasons: string[];
}
export interface CommitChanges { commit: string; events: HistoryEvent[] }
