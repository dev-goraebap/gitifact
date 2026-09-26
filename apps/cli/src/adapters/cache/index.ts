import { createCacheDatabase } from './database.js';
import { createDocumentCache } from './documents.js';
import { createHistory } from './history.js';
import { createCommitLog } from './commit-log.js';
import type { GitAccess, Originals } from './commit-changes.js';

export type { GitAccess, DocSnapshot, HistoryEvent, ChangeType, CommitReader, Originals } from './commit-changes.js';
export { MIGRATION_TRAILER } from './commit-changes.js';
export type { HistoryFilter, ListedEvent, RecordFilter, SearchHit } from './history.js';
export type { Person, FolderAuthors } from './commit-log.js';
export { CACHE_DIR, CACHE_FORMAT } from './database.js';

/**
 * The derived store behind every list, search, read and history query: `.gitifact/cache/index.db`. Nothing in it is
 * an original; the documents come from the working tree and the history from Git, and both are read again when the
 * cache is gone or of another format. Git is supplied by the caller so this adapter does not import another.
 */
export function openCache(root: string, git: GitAccess, originals?: Originals) {
  const database = createCacheDatabase(root);
  const documents = createDocumentCache(root, database);
  const history = createHistory(database, git, originals);
  const log = createCommitLog(database, git, root);
  return {
    documents, history, log, location: database.location,
    /** Documents first, so a search right after an edit finds the edited text. */
    async search(head: string | null, query: string) { await documents.sync(); return history.search(head, query); },
  };
}
export type Cache = ReturnType<typeof openCache>;
