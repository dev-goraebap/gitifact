import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { INSTRUCTIONS_ROOT, SPEC_ROOT } from '@gitifact/core';
import { transaction, type CacheDatabase } from './database.js';
import { MIGRATION_TRAILER, type GitAccess } from './commit-changes.js';

export interface Person { name: string; email: string; commits: number; latest: string }
/** Who touched one store folder and when it was last touched. */
export interface FolderAuthors { people: Person[]; latest: string }

const FORMAT = `%x1e%H%x00%aN%x00%aE%x00%at%x00%aI%x00%(trailers:key=${MIGRATION_TRAILER},valueonly,separator=%x2C)`;
// A full read goes this many commits at a time, so one Git answer stays well under the reader's output limit.
const CHUNK = 100_000;
interface Row { oid: string; name: string; email: string; time: number; date: string; migration: boolean }

/** The store folder a path belongs to: a feature folder, an instruction folder, or AGENTS.md itself. */
const folderOf = (path: string) => path === 'AGENTS.md' ? path
  : new RegExp(`^(${SPEC_ROOT.replace(/\./g, '\\.')}/[^/]+|${INSTRUCTIONS_ROOT.replace(/\./g, '\\.')}/[^/]+)/`).exec(path)?.[1];

/**
 * Every commit of HEAD once each, code commits too: who made it, when, and which store folders it touched. The
 * contributors and each folder's authors are counted from it in SQL, so a screen never walks the history again.
 *
 * The log follows one HEAD. A new HEAD reads only the difference from the one before — after a commit or a pull, the
 * new commits; after a branch switch, what the branches do not share — and marks what left. A `.mailmap` that changed
 * names people differently, so the log is read again whole. A HEAD already followed asks Git nothing.
 */
export function createCommitLog(database: CacheDatabase, git: GitAccess, root: string) {
  let following: Promise<void> | undefined; let followingHead: string | undefined;

  const read = async (args: string[]) => git.decode(await git.run(args));
  async function commits(range: string[]): Promise<Row[]> {
    const out: Row[] = [];
    for (let skip = 0; ; skip += CHUNK) {
      const text = await read(['log', `--format=${FORMAT}`, `--max-count=${CHUNK}`, `--skip=${skip}`, ...range, '--']);
      const chunk = text.split('\x1e').filter(Boolean).map(entry => {
        const [oid, name, email, time, date, migration] = entry.split('\0');
        return { oid: oid!, name: name ?? '', email: email ?? '', time: Number(time), date: date ?? '', migration: !!migration?.trim() };
      });
      out.push(...chunk);
      if (chunk.length < CHUNK) return out;
    }
  }
  async function touches(range: string[]): Promise<[string, string][]> {
    const text = await read(['log', '--format=%x1e%H', '-z', '--name-only', '--no-renames', ...range, '--', SPEC_ROOT, INSTRUCTIONS_ROOT, 'AGENTS.md']);
    const out: [string, string][] = [];
    for (const entry of text.split('\x1e').filter(Boolean)) {
      const [oid, ...paths] = entry.split('\0');
      const folders = new Set(paths.map(p => folderOf(p.replace(/^\n/, ''))).filter((f): f is string => !!f));
      for (const folder of folders) out.push([oid!.trim(), folder]);
    }
    return out;
  }
  async function mailmap() {
    const info = await lstat(join(root, '.mailmap')).catch(() => undefined);
    return info ? info.mtimeMs + ':' + info.size : '-';
  }
  const stateOf = (db: DatabaseSync, key: string) => (db.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined)?.value;

  async function follow(head: string, attempts = 3): Promise<void> {
    const names = await mailmap();
    const [before, named] = await database.with(db => [stateOf(db, 'head'), stateOf(db, 'mailmap')] as const);
    if (before === head && named === names) return;
    // The difference from the HEAD followed before, when there was one, it still exists and the names are the same.
    let change: { added: Row[]; removed: string[]; touched: [string, string][]; whole: boolean } | undefined;
    if (before && named === names) {
      try {
        const range = [head, '^' + before];
        const [added, removed, touched] = await Promise.all([commits(range), read(['rev-list', before, '^' + head, '--']), touches(range)]);
        change = { added, removed: removed.split('\n').filter(Boolean), touched, whole: false };
      } catch { change = undefined; }
    }
    if (!change) {
      const [added, touched] = await Promise.all([commits([head]), touches([head])]);
      change = { added, removed: [], touched, whole: true };
    }
    const { added, removed, touched, whole } = change;
    const written = await database.with(db => transaction(db, () => {
      // Another process may have followed a HEAD meanwhile: what it wrote is the new starting point, so read again.
      if (stateOf(db, 'head') !== before || stateOf(db, 'mailmap') !== named) return false;
      if (whole) { db.exec('DELETE FROM log'); db.exec('DELETE FROM touches'); }
      const put = db.prepare(`INSERT INTO log (oid, name, email, time, date, migration, reach) VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT (oid) DO UPDATE SET name = excluded.name, email = excluded.email, reach = 1`);
      for (const c of added) put.run(c.oid, c.name, c.email, c.time, c.date, c.migration ? 1 : 0);
      const leave = db.prepare('UPDATE log SET reach = 0 WHERE oid = ?');
      for (const oid of removed) leave.run(oid);
      const touch = db.prepare('INSERT OR IGNORE INTO touches (oid, folder) VALUES (?, ?)');
      for (const [oid, folder] of touched) touch.run(oid, folder);
      const set = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
      set.run('head', head); set.run('mailmap', names);
      return true;
    }));
    if (!written && attempts > 1) return follow(head, attempts - 1);
  }

  /** Makes sure the log follows `head`; callers in one process asking for the same HEAD share one read. */
  async function ensure(head: string): Promise<void> {
    while (following && followingHead !== head) await following.catch(() => undefined);
    if (!following) { followingHead = head; following = follow(head).finally(() => { following = undefined; followingHead = undefined; }); }
    return following;
  }

  return {
    ensure,
    /** Everyone who committed to `head`, most commits first, format migrations left out. `latest` is their newest commit. */
    async contributors(head: string): Promise<Person[]> {
      await ensure(head);
      return database.with(db => (db.prepare(`SELECT email, name, count(*) AS commits, max(time) AS time, date AS latest FROM log
        WHERE reach = 1 AND migration = 0 GROUP BY email ORDER BY commits DESC, name, email`).all() as unknown as (Person & { time: number })[])
        .map(({ name, email, commits, latest }) => ({ name, email, commits: Number(commits), latest })));
    },
    /** Each store folder's authors, most commits first, and when it was last touched, format migrations left out. */
    async folders(head: string): Promise<Map<string, FolderAuthors>> {
      await ensure(head);
      return database.with(db => {
        const rows = db.prepare(`SELECT t.folder AS folder, l.email AS email, l.name AS name, count(*) AS commits, max(l.time) AS time, l.date AS latest
          FROM touches t JOIN log l ON l.oid = t.oid WHERE l.reach = 1 AND l.migration = 0
          GROUP BY t.folder, l.email ORDER BY t.folder, commits DESC, name, email`).all() as unknown as (Person & { folder: string; time: number })[];
        const out = new Map<string, FolderAuthors & { time: number }>();
        for (const r of rows) {
          let entry = out.get(r.folder);
          if (!entry) out.set(r.folder, entry = { people: [], latest: r.latest, time: r.time });
          entry.people.push({ name: r.name, email: r.email, commits: Number(r.commits), latest: r.latest });
          if (r.time > entry.time) { entry.time = r.time; entry.latest = r.latest; }
        }
        return new Map([...out].map(([folder, { people, latest }]) => [folder, { people, latest }]));
      });
    },
  };
}
export type CommitLog = ReturnType<typeof createCommitLog>;
