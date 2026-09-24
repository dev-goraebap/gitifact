import { compareStoreBundles, emptyBundle, type StoreBundle, type StoreChange } from '@gitifact/core';
import type { DocSnapshot, HistoryEvent } from './events.js';
import { reasonRecord } from './record-events.js';

/**
 * History before the 0.8.0 migration, read with the 0.7 parser. Kept read-only until 1.0.0, so the activity people
 * recorded in 0.7 stays visible after a project moves: the migration keeps R-, S- and W- IDs, so a requirement's
 * history runs on across it. Designs were one file per feature (keyed by S-) and become D- documents, so their
 * history starts again at the migration.
 *
 * This is the plain whole-store comparison: both sides of every commit are read whole. The history before a
 * migration is finite and read once into the cache, so the faster partial reads of the current format are not
 * repeated here. A merge keeps the documents that differ from every parent; a clean automatic combination inside one
 * requirement is therefore attributed to the merge, which the 0.7 browser avoided with remerge-diff.
 */
export interface LegacyCommit { commit: string; parents: string[]; author: string; email: string; date: string; committer: string; message: string }

const snapshot = (kind: StoreChange['kind'], side: StoreChange['before']): DocSnapshot | null => side && {
  id: side.id, kind, title: side.title, description: '', body: side.body, specId: side.specId, path: side.path,
  ...(side.sources ? { sources: side.sources } : {}),
};

export async function legacyChanges(c: LegacyCommit, read: (oid: string) => Promise<StoreBundle>): Promise<HistoryEvent[]> {
  // A side the 0.7 parser cannot read (a half-written commit, a stray file) contributes nothing rather than failing history.
  const bundle = (oid: string) => read(oid).catch(() => emptyBundle());
  const after = await bundle(c.commit);
  const parents = c.parents.length ? await Promise.all(c.parents.map(bundle)) : [emptyBundle()];
  const bare = (b: StoreBundle): StoreBundle => ({ specs: b.specs.map(s => ({ ...s, history: [] })), wiki: { ...b.wiki, history: [] } });
  const differences = parents.map(p => compareStoreBundles(parents.length > 1 ? bare(p) : p, parents.length > 1 ? bare(after) : after).changes);
  const selected = parents.length > 1 ? differences[0]!.filter(change => differences.every(d => d.some(v => v.id === change.id))) : differences[0]!;
  // Reasons first written in this commit; in a merge, those no parent had.
  const reasonsOf = (b: StoreBundle) => [...b.specs.flatMap(s => s.history), ...b.wiki.history];
  const inherited = new Set(parents.flatMap(p => reasonsOf(p).map(r => r.id)));
  const added = reasonsOf(after).filter(r => !inherited.has(r.id));
  return selected.map(change => ({
    key: c.commit + ':' + change.id, commit: c.commit, date: c.date, author: c.author, email: c.email, committer: c.committer, message: c.message,
    id: change.id, kind: change.kind, types: change.types, before: snapshot(change.kind, change.before), after: snapshot(change.kind, change.after),
    records: (parents.length > 1 ? added.filter(r => [...r.requirements, ...(r.designs ?? []), ...(r.documents ?? [])].includes(change.id)) : change.reasons)
      .map(r => reasonRecord(r.id, [change.id], r.reason)).map(({ docs: _docs, ...record }) => record),
  }));
}
