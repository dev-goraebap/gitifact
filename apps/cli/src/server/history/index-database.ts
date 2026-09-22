import { DatabaseSync } from 'node:sqlite';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { specPreviewReader } from '../../adapters/git/spec-preview-reader.js';

/**
 * Bumped whenever what is stored changes meaning — a column, or how a commit's changes are computed. A file written
 * under another number is dropped and rebuilt; everything in it can be read again from Git.
 */
export const INDEX_FORMAT = 3;

const SCHEMA = `
  -- Commits already read.
  CREATE TABLE commits (oid TEXT PRIMARY KEY);
  -- One row per change. 'row' is the list shape as JSON; 'detail' the text on both sides.
  CREATE TABLE changes (
    key TEXT PRIMARY KEY, oid TEXT NOT NULL, ord INTEGER NOT NULL,
    id TEXT NOT NULL, kind TEXT NOT NULL, types TEXT NOT NULL, email TEXT NOT NULL, date TEXT NOT NULL,
    before_spec TEXT, after_spec TEXT, needle TEXT NOT NULL, row TEXT NOT NULL, detail TEXT NOT NULL);
  CREATE INDEX changes_by_commit ON changes (oid, ord);
  -- All reachable record commits of one HEAD, children before parents (pos 0 is newest).
  CREATE TABLE lineage (head TEXT NOT NULL, pos INTEGER NOT NULL, oid TEXT NOT NULL, PRIMARY KEY (head, pos));
  CREATE INDEX lineage_by_commit ON lineage (head, oid);
  CREATE TABLE heads (head TEXT PRIMARY KEY, seen INTEGER NOT NULL);
  -- Which checkout of which worktree the search rows describe.
  CREATE TABLE checkouts (scope TEXT PRIMARY KEY, stamp TEXT NOT NULL);
  -- Everything the search box finds. The searched columns hold lower-cased text; trigram lets LIKE '%...%' use the
  -- index from three characters on and scan below that. The rest is carried for display and navigation.
  CREATE VIRTUAL TABLE search USING fts5(
    scope UNINDEXED, kind UNINDEXED, ref UNINDEXED, oid UNINDEXED, payload UNINDEXED,
    title, place, body, tokenize = 'trigram');
`;

function prepare(db: DatabaseSync) {
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version === INDEX_FORMAT) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { name, type } of db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_%'").all() as { name: string; type: string }[]) {
      db.exec(`DROP ${type === 'view' ? 'VIEW' : 'TABLE'} IF EXISTS "${name}"`);
    }
    db.exec(SCHEMA);
    db.exec(`PRAGMA user_version = ${INDEX_FORMAT}`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

/**
 * The index lives beside Git's own data (`<git common dir>/gitifact/index.sqlite`): nothing appears in the working
 * tree or in `git status`, and the worktrees of one repository share it, since commits are the same everywhere.
 * A connection is opened for each use and closed after it, so a server never holds the file between requests; a
 * test can delete its repository, and two servers on one repository take turns through SQLite's own locking.
 * When the file cannot be opened — a read-only repository, say — one in-memory database stands in for this process.
 */
export function createIndexDatabase(root: string) {
  let path: Promise<string | undefined> | undefined;
  let memory: DatabaseSync | undefined;
  const usable = (file: string) => {
    try { const probe = new DatabaseSync(file); try { prepare(probe); } finally { probe.close(); } return true; }
    catch { return false; }
  };
  const locate = () => path ??= (async () => {
    try {
      const git = specPreviewReader(root);
      const common = git.decode(await git.run(['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim();
      const folder = join(common, 'gitifact'); await mkdir(folder, { recursive: true });
      const file = join(folder, 'index.sqlite');
      if (usable(file)) return file;
      // A damaged file holds nothing that Git cannot give again: it is removed and made anew, once.
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
    /** Where the index is kept, or undefined when it lives in memory. */
    location: () => locate(),
  };
}

/** Runs `write` in one immediate transaction: another server writing the same file waits instead of interleaving. */
export function transaction<T>(db: DatabaseSync, write: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const value = write(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
