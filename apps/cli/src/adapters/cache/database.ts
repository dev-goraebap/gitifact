import { DatabaseSync } from 'node:sqlite';
import { lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Bumped whenever what is stored changes meaning — a column, or how a commit's changes are computed. A file written
 * under another number is dropped and rebuilt; everything in it can be read again from the files and from Git.
 */
export const CACHE_FORMAT = 11;
export const CACHE_DIR = '.gitifact/cache';

const SCHEMA = `
  -- Working-tree files already read: the modification time and size decide whether a file is read again.
  CREATE TABLE files (path TEXT PRIMARY KEY, mtime REAL NOT NULL, size INTEGER NOT NULL, problem TEXT);
  -- The documents of the working tree, one row per readable document file. 'doc' is the parsed document as JSON.
  CREATE TABLE documents (
    path TEXT PRIMARY KEY, id TEXT NOT NULL, kind TEXT NOT NULL, feature TEXT, title TEXT NOT NULL, description TEXT NOT NULL,
    ord INTEGER, doc TEXT NOT NULL);
  CREATE INDEX documents_by_id ON documents (id);
  -- ID references from frontmatter: a design's requirements and sources. The reverse lookup reads the same rows.
  CREATE TABLE doc_references (from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL);
  CREATE INDEX doc_references_to ON doc_references (to_id);
  -- Commits already read, and with which parser: 'current', 'legacy' (0.7, before a migration) or 'migration' (hidden).
  CREATE TABLE commits (oid TEXT PRIMARY KEY, reader TEXT NOT NULL);
  -- One row per change. 'row' is the list shape as JSON with its records by ID; 'detail' where each side's text is read
  -- again from Git (commit and path), or the text itself for 0.7 history, which has no files to read again.
  CREATE TABLE changes (
    key TEXT PRIMARY KEY, oid TEXT NOT NULL, ord INTEGER NOT NULL,
    id TEXT NOT NULL, kind TEXT NOT NULL, types TEXT NOT NULL, email TEXT NOT NULL, date TEXT NOT NULL,
    before_spec TEXT, after_spec TEXT, needle TEXT NOT NULL, row TEXT NOT NULL, detail TEXT NOT NULL);
  CREATE INDEX changes_by_commit ON changes (oid, ord);
  CREATE INDEX changes_by_id ON changes (id);
  -- The records each commit added, once each; change rows name them by ID.
  CREATE TABLE records (oid TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, sections TEXT NOT NULL, PRIMARY KEY (oid, id));
  CREATE INDEX records_by_id ON records (id);
  -- All reachable record commits of one HEAD, children before parents (pos 0 is newest).
  CREATE TABLE lineage (head TEXT NOT NULL, pos INTEGER NOT NULL, oid TEXT NOT NULL, PRIMARY KEY (head, pos));
  CREATE INDEX lineage_by_commit ON lineage (head, oid);
  CREATE TABLE heads (head TEXT PRIMARY KEY, seen INTEGER NOT NULL);
  -- Every commit the log has met, code commits too: who made it and when, and whether it is a format migration.
  -- 'reach' is 1 for the commits of the HEAD the log follows now; contributors are counted over those.
  CREATE TABLE log (oid TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, time INTEGER NOT NULL, date TEXT NOT NULL,
    subject TEXT NOT NULL, migration INTEGER NOT NULL, reach INTEGER NOT NULL);
  CREATE INDEX log_by_reach ON log (reach, email);
  -- The store folders a commit touched: a feature folder, an instruction folder, or AGENTS.md.
  CREATE TABLE touches (oid TEXT NOT NULL, folder TEXT NOT NULL, PRIMARY KEY (oid, folder));
  CREATE INDEX touches_by_folder ON touches (folder);
  -- What the log follows: the HEAD ('head') and the fingerprint of the .mailmap its names were read with ('mailmap').
  CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  -- What the search box finds among the working tree's documents (scope 'checkout'); records are searched in their table.
  -- The searched columns hold lower-cased text; trigram lets LIKE '%...%' use the index from three characters on.
  CREATE VIRTUAL TABLE search USING fts5(
    scope UNINDEXED, kind UNINDEXED, ref UNINDEXED, oid UNINDEXED, payload UNINDEXED,
    title, place, body, tokenize = 'trigram');
`;

function prepare(db: DatabaseSync) {
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version === CACHE_FORMAT) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { name, type } of db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_%'").all() as { name: string; type: string }[]) {
      db.exec(`DROP ${type === 'view' ? 'VIEW' : 'TABLE'} IF EXISTS "${name}"`);
    }
    db.exec(SCHEMA);
    db.exec(`PRAGMA user_version = ${CACHE_FORMAT}`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  // Dropped tables leave their pages in the file; the new, empty tables make giving them back cheap. A process that
  // holds the file open keeps the pages, which the cache reuses as it fills.
  try { db.exec('VACUUM'); } catch { /* busy */ }
}

/**
 * The cache lives in the worktree at `.gitifact/cache/index.db`, beside a `.gitignore` of `*` that keeps the folder
 * out of Git without touching the project's own ignore rules. Each worktree has its own, so a new worktree reads its
 * history once. The CLI and the browser server share the file: a connection is opened for each use and closed after
 * it, WAL lets readers run beside a writer, and writers take turns through SQLite's own locking.
 * When the file cannot be used — a read-only checkout, say — one in-memory database stands in for this process.
 */
export function createCacheDatabase(root: string) {
  let path: Promise<string | undefined> | undefined;
  let memory: DatabaseSync | undefined;
  const usable = (file: string) => {
    try { const probe = new DatabaseSync(file); try { prepare(probe); } finally { probe.close(); } return true; }
    catch { return false; }
  };
  const locate = () => path ??= (async () => {
    try {
      const folder = join(root, ...CACHE_DIR.split('/'));
      const parent = await lstat(join(root, '.gitifact')).catch(() => undefined);
      // The cache belongs to an initialized project; it never creates the store folder or follows a link out of it.
      if (!parent?.isDirectory() || parent.isSymbolicLink()) return undefined;
      await mkdir(folder, { recursive: true });
      const info = await lstat(folder);
      if (!info.isDirectory() || info.isSymbolicLink()) return undefined;
      await writeFile(join(folder, '.gitignore'), '*\n', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const file = join(folder, 'index.db');
      if (usable(file)) return file;
      // A damaged file holds nothing that the files and Git cannot give again: it is removed and made anew, once.
      for (const leftover of [file, file + '-wal', file + '-shm']) await rm(leftover, { force: true });
      return usable(file) ? file : undefined;
    } catch { return undefined; }
  })();
  return {
    /** Runs `use` on an open database. Everything inside is synchronous, so the connection never outlives the call. */
    async with<T>(use: (db: DatabaseSync) => T): Promise<T> {
      const file = await locate();
      if (!file) {
        if (!memory) { memory = new DatabaseSync(':memory:'); prepare(memory); }
        return use(memory);
      }
      const db = new DatabaseSync(file);
      try { prepare(db); return use(db); } finally { db.close(); }
    },
    /** Where the cache is kept, or undefined when it lives in memory. */
    location: () => locate(),
  };
}
export type CacheDatabase = ReturnType<typeof createCacheDatabase>;

/** Runs `write` in one immediate transaction: another process writing the same file waits instead of interleaving. */
export function transaction<T>(db: DatabaseSync, write: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const value = write(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
