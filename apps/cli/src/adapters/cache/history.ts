import type { DatabaseSync } from 'node:sqlite';
import { createCommitChanges, type ChangeType, type CommitChanges, type CommitReader, type GitAccess, type HistoryEvent } from './commit-changes.js';
import { transaction, type CacheDatabase } from './database.js';
import { containing, snippet } from './search-text.js';

export interface HistoryFilter { kind?: ChangeType | undefined; document?: HistoryEvent['kind'] | undefined; feature?: string | undefined; author?: string | undefined; q?: string | undefined }
export interface SearchHit { id: string; kind: 'feature' | 'requirement' | 'design' | 'document' | 'history'; title: string; where: string; line: string; featureId?: string; documentId?: string; key?: string }

/** The list row of a change: the document's name and place, without the text on either side. */
const listed = (e: HistoryEvent) => {
  const reference = (s: HistoryEvent['before']) => s ? { id: s.id, title: s.title, specId: s.specId, path: s.path } : null;
  return { ...e, before: reference(e.before), after: reference(e.after) };
};
export type ListedEvent = ReturnType<typeof listed>;
const titleOf = (e: HistoryEvent) => (e.after ?? e.before)?.title ?? e.id;
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
export function createHistory(database: CacheDatabase, git: GitAccess) {
  const changes = createCommitChanges(git);
  const building = new Map<string, Promise<void>>();
  const built = new Set<string>();

  function insert(db: DatabaseSync, commits: CommitChanges[], readers: Map<string, CommitReader>) {
    const commit = db.prepare('INSERT OR IGNORE INTO commits (oid, reader) VALUES (?, ?)');
    const change = db.prepare('INSERT OR IGNORE INTO changes (key, oid, ord, id, kind, types, email, date, before_spec, after_spec, needle, row, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const search = db.prepare('INSERT INTO search (scope, kind, ref, oid, payload, title, place, body) VALUES (?,?,?,?,?,?,?,?)');
    transaction(db, () => {
      for (const c of commits) {
        // Another process may have written this commit meanwhile; its rows are the same, so they are not written twice.
        if (!Number(commit.run(c.commit, readers.get(c.commit) ?? 'current').changes)) continue;
        c.events.forEach((e, ord) => {
          change.run(e.key, e.commit, ord, e.id, e.kind, e.types.join(','), e.email, e.date, e.before?.specId ?? null, e.after?.specId ?? null,
            [e.id, e.before?.title ?? '', e.after?.title ?? ''].join(' ').toLowerCase(), JSON.stringify(listed(e)), JSON.stringify({ before: e.before, after: e.after }));
          // A change is found by its title and by why and how it was made.
          const line = e.reasons.length ? e.reasons.join(' · ') : e.message;
          const where = e.commit.slice(0, 7) + ' · ' + e.author;
          search.run('history', 'history', e.key, e.commit, JSON.stringify({ title: titleOf(e), where, line }),
            titleOf(e).toLowerCase(), where.toLowerCase(), [line, e.message, e.id].join(' ').toLowerCase());
        });
      }
    });
  }

  async function build(head: string) {
    const lineage = await changes.lineage(head);
    const readers = await changes.readers(head, lineage);
    const known = await database.with(db => new Map((db.prepare('SELECT oid, reader FROM commits').all() as { oid: string; reader: string }[]).map(r => [r.oid, r.reader])));
    // A commit read before a migration existed was read as the current format; once one exists above it, it is read again.
    const stale = lineage.filter(oid => known.has(oid) && known.get(oid) !== readers.get(oid));
    if (stale.length) await database.with(db => transaction(db, () => {
      for (const oid of stale) {
        db.prepare('DELETE FROM commits WHERE oid = ?').run(oid); db.prepare('DELETE FROM changes WHERE oid = ?').run(oid);
        db.prepare("DELETE FROM search WHERE scope = 'history' AND oid = ?").run(oid);
      }
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
    filesAt: (rev: string) => changes.tree(rev),
    /** One page of the changes that match, newest first, with how many match in all. */
    async page(head: string, filter: HistoryFilter, offset: number, limit: number) {
      await ensure(head);
      return database.with(db => {
        const { sql, params } = where(filter);
        const from = 'FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ?' + sql;
        const total = Number((db.prepare('SELECT count(*) AS n ' + from).get(head, ...params) as { n: number }).n);
        const rows = db.prepare(`SELECT c.row ${from} ORDER BY l.pos, c.ord LIMIT ? OFFSET ?`).all(head, ...params, limit, offset) as { row: string }[];
        return { total, events: rows.map(r => JSON.parse(r.row) as ListedEvent) };
      });
    },
    /** Every change of one document, newest first: `docs history`. */
    async ofDocument(head: string, id: string) {
      await ensure(head);
      return database.with(db => (db.prepare('SELECT c.row FROM lineage l JOIN changes c ON c.oid = l.oid WHERE l.head = ? AND c.id = ? ORDER BY l.pos, c.ord').all(head, id) as { row: string }[])
        .map(r => JSON.parse(r.row) as ListedEvent));
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
          events: (db.prepare('SELECT row FROM changes WHERE oid = ? ORDER BY ord LIMIT ?').all(c.oid, RECENT_CHANGES) as { row: string }[]).map(r => JSON.parse(r.row) as ListedEvent) }));
        return { total, byType: { created: count('created'), modified: count('modified'), moved: count('moved'), deleted: count('deleted') }, pulse, recent };
      });
    },
    /** One change with the text on both sides; a commit the cache has not read yet is read now. */
    async change(key: string): Promise<{ event: ListedEvent; before: HistoryEvent['before']; after: HistoryEvent['after'] } | undefined> {
      const lookup = () => database.with(db => db.prepare('SELECT row, detail FROM changes WHERE key = ?').get(key) as { row: string; detail: string } | undefined);
      let found = await lookup();
      if (!found) {
        const commit = key.slice(0, key.indexOf(':'));
        const known = await database.with(db => !!db.prepare('SELECT 1 FROM commits WHERE oid = ?').get(commit));
        if (known) return undefined;
        // A commit outside every lineage read so far: read it as the current format. Its HEAD's lineage, when built, decides again.
        const read = await changes.of([commit]).catch(() => undefined);
        if (!read) return undefined;
        await database.with(db => insert(db, read, new Map()));
        found = await lookup();
      }
      if (!found) return undefined;
      const detail = JSON.parse(found.detail) as { before: HistoryEvent['before']; after: HistoryEvent['after'] };
      return { event: JSON.parse(found.row) as ListedEvent, before: detail.before, after: detail.after };
    },
    /**
     * Documents whose title, place or text holds the query — a title match before a place match before a text match —
     * then past changes of `head`'s history, newest first. The caller syncs the working documents first.
     */
    async search(head: string | null, raw: string): Promise<SearchHit[]> {
      const query = raw.trim().toLowerCase();
      if (!query) return [];
      if (head) await ensure(head);
      return database.with(db => {
        // The trigram index answers LIKE from three characters on. Pattern characters in the query are matched
        // literally with instr instead, which scans but is never wrong.
        const literal = /[\\%_]/.test(query);
        const match = (column: string) => literal ? `instr(${column}, ?) > 0` : `${column} LIKE ?`;
        const needle = literal ? query : containing(query);
        const features = new Map((db.prepare("SELECT feature, id FROM documents WHERE kind = 'feature'").all() as { feature: string; id: string }[]).map(r => [r.feature, r.id]));
        const found = db.prepare(`SELECT kind, payload, title, place FROM search WHERE scope = 'checkout' AND (${match('title')} OR ${match('place')} OR ${match('body')}) LIMIT 400`)
          .all(needle, needle, needle) as { kind: Exclude<SearchHit['kind'], 'history'>; payload: string; title: string; place: string }[];
        const documents = found.map(r => {
          const at = r.title.indexOf(query);
          const rank = at === 0 ? 0 : at > 0 ? 1 : r.place.includes(query) ? 2 : 3;
          const p = JSON.parse(r.payload) as { id: string; title: string; where: string; body: string; feature: string | null };
          const featureId = p.feature ? features.get(p.feature) : undefined;
          const hit: SearchHit = { id: p.id, kind: r.kind, title: p.title, where: p.where, line: snippet(p.body, query),
            ...(featureId ? { featureId } : {}), ...(r.kind === 'document' ? { documentId: p.id } : {}) };
          return { rank, hit };
        }).sort((a, b) => a.rank - b.rank || a.hit.title.localeCompare(b.hit.title)).slice(0, 24).map(r => r.hit);
        const past = !head ? [] : (db.prepare(`SELECT s.ref AS ref, s.payload AS payload FROM search s JOIN lineage l ON l.head = ? AND l.oid = s.oid
          WHERE s.scope = 'history' AND (${match('s.title')} OR ${match('s.body')}) ORDER BY l.pos LIMIT 8`).all(head, needle, needle) as { ref: string; payload: string }[])
          .map(r => { const p = JSON.parse(r.payload) as { title: string; where: string; line: string };
            return { id: r.ref, kind: 'history' as const, title: p.title, where: p.where, line: snippet(p.line, query), key: r.ref }; });
        return [...documents, ...past];
      });
    },
  };
}
