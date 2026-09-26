import type { DatabaseSync } from 'node:sqlite';
import { createCommitChanges, type ChangeType, type CommitChanges, type CommitReader, type GitAccess, type HistoryEvent, type Originals } from './commit-changes.js';
import type { DocSnapshot, EventRecord } from './events.js';
import { transaction, type CacheDatabase } from './database.js';
import { snippet } from './search-text.js';

export interface HistoryFilter { kind?: ChangeType | undefined; document?: HistoryEvent['kind'] | undefined; feature?: string | undefined; author?: string | undefined; q?: string | undefined }
/** What `records list` filters by: the author's name or email, words, a first moment (ms), or the commits allowed. */
export interface RecordFilter { author?: string | undefined; q?: string | undefined; from?: number | undefined; commits?: string[] | undefined }

/** The list row of a change: the document's name and place, without the text on either side. */
const listed = (e: HistoryEvent) => {
  const reference = (s: HistoryEvent['before']) => s ? { id: s.id, title: s.title, specId: s.specId, path: s.path } : null;
  const { source: _source, ...event } = e;
  return { ...event, before: reference(e.before), after: reference(e.after) };
};
export type ListedEvent = ReturnType<typeof listed>;
/** A row as stored: its records by ID, since the records table holds each record once per commit. */
type StoredEvent = Omit<ListedEvent, 'records'> & { records: string[] };
/**
 * Where each side of a change is: the commit and path its text is read at again, or, for 0.7 history, which has no
 * files to read again, the text itself.
 */
type Side = { rev: string; path: string } | DocSnapshot | null;
const sideOf = (snapshot: DocSnapshot | null, rev: string | null | undefined): Side => !snapshot ? null : rev ? { rev, path: snapshot.path } : snapshot;
const DAY = 86_400_000;
// A HEAD's lineage is kept for the last few HEADs seen, so switching back and forth between branches stays cheap.
const KEPT_HEADS = 4;
// The newest commits the overview shows, and how many of each one's changes it lists.
const RECENT_COMMITS = 3; const RECENT_CHANGES = 12;

/**
 * History in the cache, so every screen and command filters, searches, pages and counts over all of it.
 *
 * Commits never change, so a commit's changes are read once and kept for good; a HEAD only adds the order of its
 * commits. A new HEAD reads the commits the cache does not have yet — after a pull, the new ones; after a branch
 * switch, usually none. Queries are then plain SQL over rows and ask Git nothing.
 */
export function createHistory(database: CacheDatabase, git: GitAccess, originals?: Originals) {
  const changes = createCommitChanges(git);
  // The text a change shows is read through the originals, Git unless the caller gives another source.
  const texts: Originals = originals ?? changes;
  const building = new Map<string, Promise<void>>();
  const built = new Set<string>();

  function insert(db: DatabaseSync, commits: CommitChanges[], readers: Map<string, CommitReader>) {
    const commit = db.prepare('INSERT OR IGNORE INTO commits (oid, reader) VALUES (?, ?)');
    const change = db.prepare('INSERT OR IGNORE INTO changes (key, oid, ord, id, kind, types, email, date, before_spec, after_spec, needle, row, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const record = db.prepare('INSERT OR IGNORE INTO records (oid, id, title, sections) VALUES (?, ?, ?, ?)');
    transaction(db, () => {
      for (const c of commits) {
        // Another process may have written this commit meanwhile; its rows are the same, so they are not written twice.
        if (!Number(commit.run(c.commit, readers.get(c.commit) ?? 'current').changes)) continue;
        c.events.forEach((e, ord) => {
          for (const r of e.records) record.run(e.commit, r.id, r.title, JSON.stringify(r.sections));
          const row: StoredEvent = { ...listed(e), records: e.records.map(r => r.id) };
          const detail = { before: sideOf(e.before, e.source?.before), after: sideOf(e.after, e.source?.after) };
          change.run(e.key, e.commit, ord, e.id, e.kind, e.types.join(','), e.email, e.date, e.before?.specId ?? null, e.after?.specId ?? null,
            [e.id, e.before?.title ?? '', e.after?.title ?? ''].join(' ').toLowerCase(), JSON.stringify(row), JSON.stringify(detail));
        });
      }
    });
  }

  async function build(head: string) {
    // A HEAD whose lineage is written was read whole: its commits never change, so Git is not asked again.
    const known = await database.with(db => {
      const seen = !!db.prepare('SELECT 1 FROM heads WHERE head = ?').get(head);
      if (seen) db.prepare('UPDATE heads SET seen = ? WHERE head = ?').run(Date.now(), head);
      return seen;
    });
    if (!known) await read(head);
  }

  async function read(head: string) {
    const lineage = await changes.lineage(head);
    const readers = await changes.readers(head, lineage);
    const known = await database.with(db => new Map((db.prepare('SELECT oid, reader FROM commits').all() as { oid: string; reader: string }[]).map(r => [r.oid, r.reader])));
    // A commit read before a migration existed was read as the current format; once one exists above it, it is read again.
    const stale = lineage.filter(oid => known.has(oid) && known.get(oid) !== readers.get(oid));
    if (stale.length) await database.with(db => transaction(db, () => {
      for (const oid of stale) {
        db.prepare('DELETE FROM commits WHERE oid = ?').run(oid); db.prepare('DELETE FROM changes WHERE oid = ?').run(oid); db.prepare('DELETE FROM records WHERE oid = ?').run(oid);
      }
      // Other HEADs listed these commits as they were read before; they are read again when next asked for.
      db.prepare('DELETE FROM lineage WHERE head != ?').run(head); db.prepare('DELETE FROM heads WHERE head != ?').run(head);
    }));
    const missing = lineage.filter(oid => !known.has(oid) || stale.includes(oid));
    // Written a hundred commits at a time, so a long first read that is interrupted keeps what it had read.
    for (let i = 0; i < missing.length; i += 100) {
      const read = await changes.of(missing.slice(i, i + 100), readers);
      await database.with(db => insert(db, read, readers));
    }
    await database.with(db => transaction(db, () => {
      db.prepare('DELETE FROM lineage WHERE head = ?').run(head);
      const row = db.prepare('INSERT INTO lineage (head, pos, oid) VALUES (?, ?, ?)');
      lineage.forEach((oid, pos) => row.run(head, pos, oid));
      db.prepare('INSERT INTO heads (head, seen) VALUES (?, ?) ON CONFLICT (head) DO UPDATE SET seen = excluded.seen').run(head, Date.now());
      for (const { head: old } of db.prepare('SELECT head FROM heads ORDER BY seen DESC LIMIT -1 OFFSET ?').all(KEPT_HEADS) as { head: string }[]) {
        db.prepare('DELETE FROM lineage WHERE head = ?').run(old); db.prepare('DELETE FROM heads WHERE head = ?').run(old);
      }
    }));
  }

  /** Makes sure the cache holds every commit of `head` and their order; concurrent callers share one build. */
  function ensure(head: string): Promise<void> {
    if (built.has(head)) return Promise.resolve();
    let pending = building.get(head);
    if (!pending) {
      pending = build(head).then(() => { built.add(head); }).finally(() => building.delete(head));
      building.set(head, pending);
    }
    return pending;
  }

  /** Makes sure the cache has a commit's changes: one no lineage has read yet (an old link, another branch) is read once as the current format. */
  async function readCommit(commit: string) {
    const known = await database.with(db => !!db.prepare('SELECT 1 FROM commits WHERE oid = ?').get(commit));
    if (known) return;
    const read = await changes.of([commit]).catch(() => undefined);
    if (read) await database.with(db => insert(db, read, new Map()));
  }
  /**
   * The IDs a record stands for in its commit: itself, and for a reason from before decision records (`H-`), every
   * reason of the commit with the same text — 0.7 stored one reason once per document it explained.
   */
  function sameRecord(db: DatabaseSync, commit: string, id: string): string[] {
    if (!id.startsWith('H-')) return [id];
    const own = db.prepare('SELECT title, sections FROM records WHERE oid = ? AND id = ?').get(commit, id) as { title: string; sections: string } | undefined;
    if (!own) return [id];
    return (db.prepare("SELECT id FROM records WHERE oid = ? AND id LIKE 'H-%' AND title = ? AND sections = ?").all(commit, own.title, own.sections) as { id: string }[]).map(r => r.id);
  }
  /** Stored rows as the lists send them, with each record's title and sections from the records table. */
  function hydrate(db: DatabaseSync, rows: string[]): ListedEvent[] {
    const events = rows.map(row => JSON.parse(row) as StoredEvent);
    const read = db.prepare('SELECT id, title, sections FROM records WHERE oid = ?');
    const byCommit = new Map<string, Map<string, EventRecord>>();
    for (const e of events) if (e.records.length && !byCommit.has(e.commit)) {
      byCommit.set(e.commit, new Map((read.all(e.commit) as { id: string; title: string; sections: string }[])
        .map(r => [r.id, { id: r.id, title: r.title, sections: JSON.parse(r.sections) as EventRecord['sections'] }])));
    }
    return events.map(e => ({ ...e, records: e.records.flatMap(id => { const r = byCommit.get(e.commit)?.get(id); return r ? [r] : []; }) }));
  }
  /** Changes with the text on both sides: 0.7 history keeps it, anything else is read again from Git in one batch. */
  async function detailOf(rows: { row: string; detail: string }[]) {
    const events = await database.with(db => hydrate(db, rows.map(r => r.row)));
    const sides = rows.map(r => JSON.parse(r.detail) as { before: Side; after: Side });
    const places: { rev: string; path: string; specId: string }[] = [];
    sides.forEach((side, i) => {
      for (const key of ['before', 'after'] as const) {
        const value = side[key];
        if (value && 'rev' in value) places.push({ rev: value.rev, path: value.path, specId: events[i]![key]?.specId ?? '' });
      }
    });
    const read = places.length ? await texts.sides(places) : [];
    const text = new Map(places.map((p, i) => [p.rev + ':' + p.path, read[i] ?? null]));
    const resolve = (value: Side): DocSnapshot | null => !value ? null : 'rev' in value ? text.get(value.rev + ':' + value.path) ?? null : value;
    return events.map((event, i) => ({ event, before: resolve(sides[i]!.before), after: resolve(sides[i]!.after) }));
  }

  function where(filter: HistoryFilter) {
    const clauses: string[] = []; const params: (string | number)[] = [];
    if (filter.kind) { clauses.push("instr(',' || c.types || ',', ?) > 0"); params.push(',' + filter.kind + ','); }
    if (filter.document) { clauses.push('c.kind = ?'); params.push(filter.document); }
    if (filter.feature) { clauses.push('(c.before_spec = ? OR c.after_spec = ?)'); params.push(filter.feature, filter.feature); }
    if (filter.author) { clauses.push('c.email = ?'); params.push(filter.author); }
    if (filter.q?.trim()) { clauses.push('instr(c.needle, ?) > 0'); params.push(filter.q.trim().toLowerCase()); }
    return { sql: clauses.map(c => ' AND ' + c).join(''), params };
  }

  return {
    ensure,
    /** The document and reason files of one commit, read from Git and not kept. */
    filesAt: (rev: string) => texts.tree(rev),
    /**
     * The changes that match, newest first, a page of whole commits: `limit` commits after the commit `after`, each
     * with all of its matching changes, and how many changes and commits match in all. `next` is the last commit of the
     * page when more follow. A commit `after` that is not in `head`'s matching history answers undefined.
     */
    async commits(head: string, filter: HistoryFilter, after: string | undefined, limit: number) {
      await ensure(head);
      return database.with(db => {
        const { sql, params } = where(filter);
        const from = 'FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ?' + sql;
        const counted = db.prepare('SELECT count(*) AS n, count(DISTINCT c.oid) AS commits ' + from).get(head, ...params) as { n: number; commits: number };
        let start = -1;
        if (after !== undefined) {
          const found = db.prepare('SELECT l.pos AS pos ' + from + ' AND l.oid = ? LIMIT 1').get(head, ...params, after) as { pos: number } | undefined;
          if (!found) return undefined;
          start = found.pos;
        }
        // One more commit than the page holds tells whether another page follows.
        const commits = (db.prepare(`SELECT l.pos AS pos, l.oid AS oid ${from} AND l.pos > ? GROUP BY l.pos, l.oid ORDER BY l.pos LIMIT ?`)
          .all(head, ...params, start, limit + 1) as { pos: number; oid: string }[]);
        const shown = commits.slice(0, limit);
        const rows = !shown.length ? [] : db.prepare(`SELECT c.row ${from} AND l.pos >= ? AND l.pos <= ? ORDER BY l.pos, c.ord`)
          .all(head, ...params, shown[0]!.pos, shown[shown.length - 1]!.pos) as { row: string }[];
        return { total: Number(counted.n), commits: Number(counted.commits), next: commits.length > limit ? shown[shown.length - 1]!.oid : null,
          events: hydrate(db, rows.map(r => r.row)) };
      });
    },
    /**
     * The changes of one commit without their text, a page at a time after the change `after` (a key): the commit page's
     * list. With `record`, only the changes that record explains: the record page's documents.
     */
    async commitChanges(commit: string, after: string | undefined, limit: number, record?: string) {
      await readCommit(commit);
      return database.with(db => {
        const ids = record === undefined ? undefined : JSON.stringify(sameRecord(db, commit, record));
        const all = (ids === undefined ? db.prepare('SELECT key, row FROM changes WHERE oid = ? ORDER BY ord').all(commit)
          : db.prepare("SELECT key, row FROM changes c WHERE oid = ? AND EXISTS (SELECT 1 FROM json_each(c.row, '$.records') j WHERE j.value IN (SELECT value FROM json_each(?))) ORDER BY ord")
            .all(commit, ids)) as { key: string; row: string }[];
        const start = after === undefined ? 0 : all.findIndex(r => r.key === after) + 1;
        if (after !== undefined && !start) return undefined;
        const shown = all.slice(start, start + limit);
        return { total: all.length, next: start + shown.length < all.length ? shown[shown.length - 1]!.key : null, events: hydrate(db, shown.map(r => r.row)) };
      });
    },
    /** One change of a commit with the text on both sides, read again from Git: the change the reader opened. */
    async commitChange(commit: string, id: string) {
      await readCommit(commit);
      const rows = await database.with(db => db.prepare('SELECT row, detail FROM changes WHERE oid = ? AND id = ? ORDER BY ord LIMIT 1').all(commit, id) as { row: string; detail: string }[]);
      return rows.length ? (await detailOf(rows))[0] : undefined;
    },
    /** Every change of one document, newest first: `records list --doc`. */
    async ofDocument(head: string, id: string) {
      await ensure(head);
      return database.with(db => hydrate(db, (db.prepare('SELECT c.row FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ? AND c.id = ? ORDER BY l.pos, c.ord').all(head, id) as { row: string }[]).map(r => r.row)));
    },
    /** Who changed which document in which commit of `head`'s history, newest first: what the lists filter and sort by. */
    async changesOf(head: string): Promise<{ id: string; commit: string; date: string; author: string; email: string }[]> {
      await ensure(head);
      return database.with(db => db.prepare(`SELECT c.id AS id, c.oid AS "commit", c.date AS date, json_extract(c.row, '$.author') AS author, c.email AS email
        FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ? ORDER BY l.pos, c.ord`).all(head) as { id: string; commit: string; date: string; author: string; email: string }[]);
    },
    /**
     * The records of `head`'s history that match, newest first, a page at a time: what `records list` shows after the
     * records not committed yet. The filters and the page are SQL over the records table, so a page reads only its
     * rows. `after` is the ID of the last record of the previous page; `limit` undefined is every match.
     */
    async records(head: string, filter: RecordFilter, after: string | undefined, limit: number | undefined) {
      await ensure(head);
      return database.with(db => {
        const clauses: string[] = []; const params: (string | number)[] = [];
        if (filter.author) { clauses.push("(lower(json_extract(row, '$.author')) = ? OR lower(json_extract(row, '$.email')) = ?)"); params.push(filter.author.toLowerCase(), filter.author.toLowerCase()); }
        if (filter.q?.trim()) { clauses.push("instr(lower(title || ' ' || body || ' ' || json_extract(row, '$.message')), ?) > 0"); params.push(filter.q.trim().toLowerCase()); }
        if (filter.from !== undefined) { clauses.push("unixepoch(json_extract(row, '$.date')) * 1000 >= ?"); params.push(filter.from); }
        if (filter.commits) { clauses.push('oid IN (SELECT value FROM json_each(?))'); params.push(JSON.stringify(filter.commits)); }
        // One commit row names who made it and when; the bodies of the sections are what --q reads, not their keys.
        const matching = `WITH meta AS (SELECT l.pos AS pos, r.oid AS oid, r.id AS id, r.title AS title, r.sections AS sections,
            (SELECT group_concat(json_extract(s.value, '$.body'), ' ') FROM json_each(r.sections) s) AS body,
            (SELECT c.row FROM changes c WHERE c.oid = r.oid ORDER BY c.ord LIMIT 1) AS row
          FROM lineage l JOIN records r ON r.oid = l.oid WHERE l.head = ?)
          SELECT * FROM meta WHERE 1 = 1${clauses.map(c => ' AND ' + c).join('')}`;
        const total = Number((db.prepare(`SELECT count(*) AS n FROM (${matching})`).get(head, ...params) as { n: number }).n);
        let from: { pos: number; id: string } | undefined;
        if (after !== undefined) {
          from = db.prepare(`SELECT pos, id FROM (${matching}) WHERE id = ?`).get(head, ...params, after) as { pos: number; id: string } | undefined;
          if (!from) return undefined;
        }
        const rows = db.prepare(`SELECT oid, id, title, sections, row FROM (${matching})${from ? ' WHERE (pos, id) > (?, ?)' : ''} ORDER BY pos, id LIMIT ?`)
          .all(head, ...params, ...(from ? [from.pos, from.id] : []), limit ?? -1) as { oid: string; id: string; title: string; sections: string; row: string }[];
        const docsOf = db.prepare("SELECT c.id AS id FROM changes c, json_each(c.row, '$.records') j WHERE c.oid = ? AND j.value = ? ORDER BY c.ord");
        const records = rows.map(r => {
          const commit = JSON.parse(r.row) as StoredEvent;
          return { id: r.id, title: r.title, sections: JSON.parse(r.sections) as EventRecord['sections'], commit: r.oid, date: commit.date, author: commit.author,
            email: commit.email, message: commit.message, docs: (docsOf.all(r.oid, r.id) as { id: string }[]).map(d => d.id) };
        });
        return { records, total };
      });
    },
    /** Counts over all of history and its newest commits, for the overview. */
    async summary(head: string) {
      await ensure(head);
      return database.with(db => {
        const from = 'FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ?';
        const count = (type: ChangeType) => Number((db.prepare(`SELECT count(*) AS n ${from} AND instr(',' || c.types || ',', ?) > 0`).get(head, ',' + type + ',') as { n: number }).n);
        const total = Number((db.prepare(`SELECT count(*) AS n ${from}`).get(head) as { n: number }).n);
        const commits = db.prepare(`SELECT l.oid AS oid, max(c.date) AS date, count(*) AS n ${from} GROUP BY l.pos, l.oid ORDER BY l.pos`).all(head) as { oid: string; date: string; n: number }[];
        // Three weeks back from the newest change, with a day to spare for readers in other time zones.
        const newest = Math.max(0, ...commits.map(c => Date.parse(c.date)).filter(Number.isFinite));
        const pulse = commits.filter(c => Date.parse(c.date) >= newest - 22 * DAY).map(c => ({ date: c.date, count: Number(c.n) }));
        const recent = commits.slice(0, RECENT_COMMITS).map(c => ({ commit: c.oid, count: Number(c.n),
          events: hydrate(db, (db.prepare('SELECT row FROM changes WHERE oid = ? ORDER BY ord LIMIT ?').all(c.oid, RECENT_CHANGES) as { row: string }[]).map(r => r.row)) }));
        return { total, byType: { created: count('created'), modified: count('modified'), moved: count('moved'), deleted: count('deleted') }, pulse, recent };
      });
    },
    /**
     * The record of `head`'s history with the commit that added it, and how many other records that commit holds (a
     * 0.7 reason written once over several documents counts once). Undefined when the history has no such record.
     */
    async recordOf(head: string, id: string) {
      await ensure(head);
      return database.with(db => {
        const found = db.prepare('SELECT r.oid AS oid, r.title AS title, r.sections AS sections FROM lineage l JOIN records r ON r.oid = l.oid WHERE l.head = ? AND r.id = ? ORDER BY l.pos LIMIT 1')
          .get(head, id) as { oid: string; title: string; sections: string } | undefined;
        if (!found) return undefined;
        const all = db.prepare('SELECT id, title, sections FROM records WHERE oid = ?').all(found.oid) as { id: string; title: string; sections: string }[];
        const groups = new Set(all.map(r => r.id.startsWith('H-') ? 'H\0' + r.title + '\0' + r.sections : r.id));
        return { commit: found.oid, record: { id, title: found.title, sections: JSON.parse(found.sections) as EventRecord['sections'] }, others: groups.size - 1 };
      });
    },
    /**
     * The records of `head`'s history whose title, ID or sections hold the query, one hit per record file, a page at a
     * time: a title that starts with it first, then a title, the ID, and the sections; newest first within each. `after`
     * is the ID of the last hit of the page before; one that no longer matches answers undefined.
     */
    async searchRecords(head: string, raw: string, after: string | undefined, limit: number) {
      const query = raw.trim().toLowerCase();
      await ensure(head);
      return database.with(db => {
        const ordered = `WITH own AS (
            SELECT r.id AS id, r.title AS title, r.oid AS oid, min(l.pos) AS pos, r.sections AS sections,
              lower((SELECT group_concat(json_extract(s.value, '$.body'), ' ') FROM json_each(r.sections) s)) AS body
            FROM lineage l JOIN records r ON r.oid = l.oid WHERE l.head = :head GROUP BY r.id),
          hits AS (SELECT *, CASE WHEN substr(lower(title), 1, length(:q)) = :q THEN 0 WHEN instr(lower(title), :q) > 0 THEN 1
              WHEN instr(lower(id), :q) > 0 THEN 2 ELSE 3 END AS rank
            FROM own WHERE instr(lower(title), :q) > 0 OR instr(lower(id), :q) > 0 OR instr(body, :q) > 0),
          ordered AS (SELECT *, row_number() OVER (ORDER BY rank, pos, id) AS n FROM hits)`;
        const params = { head, q: query };
        const total = Number((db.prepare(`${ordered} SELECT count(*) AS n FROM ordered`).get(params) as { n: number }).n);
        let start = 0;
        if (after !== undefined) {
          const at = db.prepare(`${ordered} SELECT n FROM ordered WHERE id = :after`).get({ ...params, after }) as { n: number } | undefined;
          if (!at) return undefined;
          start = Number(at.n);
        }
        const rows = db.prepare(`${ordered} SELECT id, title, oid, sections FROM ordered WHERE n > :start ORDER BY n LIMIT :limit`)
          .all({ ...params, start, limit: limit + 1 }) as { id: string; title: string; oid: string; sections: string }[];
        const hits = rows.slice(0, limit).map(r => {
          const text = (JSON.parse(r.sections) as EventRecord['sections']).map(s => s.body).join(' ');
          return { id: r.id, kind: 'record' as const, title: r.title, where: r.id + ' · ' + r.oid.slice(0, 7), line: snippet(text, query), commit: r.oid };
        });
        return { total, next: rows.length > limit ? hits[hits.length - 1]!.id : null, hits };
      });
    },
  };
}
