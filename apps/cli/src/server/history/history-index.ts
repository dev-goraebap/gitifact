import { getLanguage } from '../../shared/i18n/index.js';
import type { DatabaseSync } from 'node:sqlite';
import type { PreviewBundle } from '@gitifact/core';
import { createCommitChanges, type CommitChanges, type HistoryEvent } from './commit-changes.js';
import { createIndexDatabase, transaction } from './index-database.js';
import { containing, plain, snippet } from './search-text.js';

type ChangeType = HistoryEvent['types'][number];
export interface HistoryFilter { kind?: ChangeType | undefined; document?: HistoryEvent['kind'] | undefined; feature?: string | undefined; author?: string | undefined; q?: string | undefined }
/** A record of the current checkout, as the search box finds it. */
export interface SearchDocument { kind: 'feature' | 'requirement' | 'design' | 'document'; ref: string; title: string; where: string; body: string; featureId?: string; documentId?: string }
export interface SearchHit { id: string; kind: SearchDocument['kind'] | 'history'; title: string; where: string; line: string; featureId?: string; documentId?: string; key?: string }

/** The list row of a change: the record's name and place, without the text on either side. */
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
 * The browser's history as a local index, so every screen filters, searches, pages and counts over all of it.
 *
 * Commits never change, so a commit's changes are read once and kept in SQLite (see index-database.ts) for good; a
 * HEAD only adds the order of its commits. A new HEAD reads the commits the index does not have yet — after a pull,
 * the new ones; after a branch switch, usually none. Queries are then plain SQL over rows and ask Git nothing.
 */
export function createHistoryIndex(root: string, snapshot: (oid: string) => Promise<PreviewBundle>) {
  const changes = createCommitChanges(root, snapshot);
  const database = createIndexDatabase(root);
  const building = new Map<string, Promise<void>>();
  const built = new Set<string>();

  function insert(db: DatabaseSync, commits: CommitChanges[]) {
    const commit = db.prepare('INSERT OR IGNORE INTO commits (oid) VALUES (?)');
    const change = db.prepare('INSERT OR IGNORE INTO changes (key, oid, ord, id, kind, types, email, date, before_spec, after_spec, needle, row, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const search = db.prepare('INSERT INTO search (scope, kind, ref, oid, payload, title, place, body) VALUES (?,?,?,?,?,?,?,?)');
    transaction(db, () => {
      for (const c of commits) {
        // Another server may have written this commit meanwhile; its rows are the same, so they are not written twice.
        if (!Number(commit.run(c.commit).changes)) continue;
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
    const known = await database.with(db => new Set((db.prepare('SELECT oid FROM commits').all() as { oid: string }[]).map(r => r.oid)));
    const missing = lineage.filter(oid => !known.has(oid));
    // Written a hundred commits at a time, so a long first read that is interrupted keeps what it had read.
    for (let i = 0; i < missing.length; i += 100) {
      const read = await changes.of(missing.slice(i, i + 100));
      await database.with(db => insert(db, read));
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

  /** Makes sure the index holds every commit of `head` and their order; concurrent callers share one build. */
  function ensure(head: string): Promise<void> {
    if (built.has(head)) return Promise.resolve();
    const key = head + ':' + getLanguage();
    let pending = building.get(key);
    if (!pending) {
      pending = build(head).then(() => { built.add(head); }).finally(() => building.delete(key));
      building.set(key, pending);
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
    /** One change with the text on both sides; a commit the index has not read yet is read now. */
    async change(key: string): Promise<{ event: ListedEvent; before: HistoryEvent['before']; after: HistoryEvent['after'] } | undefined> {
      const lookup = () => database.with(db => db.prepare('SELECT row, detail FROM changes WHERE key = ?').get(key) as { row: string; detail: string } | undefined);
      let found = await lookup();
      if (!found) {
        const commit = key.slice(0, key.indexOf(':'));
        const known = await database.with(db => !!db.prepare('SELECT 1 FROM commits WHERE oid = ?').get(commit));
        if (known) return undefined;
        const read = await changes.of([commit]).catch(() => undefined);
        if (!read) return undefined;
        await database.with(db => insert(db, read));
        found = await lookup();
      }
      if (!found) return undefined;
      const detail = JSON.parse(found.detail) as { before: HistoryEvent['before']; after: HistoryEvent['after'] };
      return { event: JSON.parse(found.row) as ListedEvent, before: detail.before, after: detail.after };
    },
    /** Replaces the search rows of one worktree's checkout when it changed since they were written. */
    async syncCheckout(scope: string, stamp: string, documents: SearchDocument[]) {
      await database.with(db => {
        const current = db.prepare('SELECT stamp FROM checkouts WHERE scope = ?').get(scope) as { stamp: string } | undefined;
        if (current?.stamp === stamp) return;
        transaction(db, () => {
          db.prepare('DELETE FROM search WHERE scope = ?').run(scope);
          const row = db.prepare('INSERT INTO search (scope, kind, ref, oid, payload, title, place, body) VALUES (?,?,?,?,?,?,?,?)');
          for (const d of documents) {
            const body = plain(d.body);
            row.run(scope, d.kind, d.ref, null, JSON.stringify({ title: d.title, where: d.where, body, featureId: d.featureId, documentId: d.documentId }),
              d.title.toLowerCase(), d.where.toLowerCase(), body.toLowerCase());
          }
          db.prepare('INSERT INTO checkouts (scope, stamp) VALUES (?, ?) ON CONFLICT (scope) DO UPDATE SET stamp = excluded.stamp').run(scope, stamp);
        });
      });
    },
    /**
     * Records whose title, place or text holds the query. The checkout comes first — a title match before a place
     * match before a text match — then past changes of `head`'s history, newest first.
     */
    async search(scope: string, head: string | null, raw: string): Promise<SearchHit[]> {
      const query = raw.trim().toLowerCase();
      if (!query) return [];
      if (head) await ensure(head);
      return database.with(db => {
        // The trigram index answers LIKE from three characters on. Pattern characters in the query are matched
        // literally with instr instead, which scans but is never wrong.
        const literal = /[\\%_]/.test(query);
        const match = (column: string) => literal ? `instr(${column}, ?) > 0` : `${column} LIKE ?`;
        const needle = literal ? query : containing(query);
        const found = db.prepare(`SELECT kind, ref, payload, title, place, body FROM search WHERE scope = ? AND (${match('title')} OR ${match('place')} OR ${match('body')}) LIMIT 400`)
          .all(scope, needle, needle, needle) as { kind: SearchDocument['kind']; ref: string; payload: string; title: string; place: string; body: string }[];
        const documents = found.map(r => {
          const at = r.title.indexOf(query);
          const rank = at === 0 ? 0 : at > 0 ? 1 : r.place.includes(query) ? 2 : 3;
          const p = JSON.parse(r.payload) as { title: string; where: string; body: string; featureId?: string; documentId?: string };
          const hit: SearchHit = { id: r.ref, kind: r.kind, title: p.title, where: p.where, line: snippet(p.body, query),
            ...(p.featureId ? { featureId: p.featureId } : {}), ...(p.documentId ? { documentId: p.documentId } : {}) };
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
