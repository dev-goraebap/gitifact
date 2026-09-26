import { arrangeDocuments, type DesignDoc, type Doc, type FeatureDoc } from '@gitifact/core';
import type { Cache } from '../adapters/cache/index.js';
import type { StoreReader } from '../adapters/git/store-reader.js';
import { CommandError } from '../commands/output.js';
import { byAuthor, since, type Change } from './filters.js';
import { documentStates } from './document-states.js';
import { pageOf, type PageRequest } from './paging.js';
import { t } from '../shared/i18n/index.js';

/** What the list queries read: HEAD, Git under the guarded environment, and the cache. */
export interface ListSource { head(): Promise<string | null>; reader: StoreReader; cache: Cache }

export type SpecKind = 'feature' | 'requirement' | 'design';
export interface SpecFilter {
  type?: SpecKind | undefined; feature?: string | undefined; withoutDesign?: boolean | undefined; uncovered?: boolean | undefined; draft?: boolean | undefined;
  changedSince?: string | undefined; author?: string | undefined; q?: string | undefined; sort: 'order' | 'title' | 'updated';
  /** Whether each row carries its latest change even when no filter or order needs history. */
  withUpdated?: boolean | undefined;
}
export type Titled = { id: string; title: string | null };

/** A design source with the title of the document it names, or the outside page as written. */
export const titledSources = (d: DesignDoc, byId: ReadonlyMap<string, Doc>) =>
  d.sources.map(s => 'id' in s ? { id: s.id, title: byId.get(s.id)?.title ?? null, ...(s.note ? { note: s.note } : {}) } : s);

/**
 * `specs list`: features, requirements and designs without their bodies, one row per document, with where each stands
 * against the last commit; a document deleted since then is listed as to be deleted until the commit. The filters pick
 * rows by relation (designs and the requirements they cover), by state (drafts) and by history (who changed what since
 * when). History is read only when an option needs it, so a plain list never walks the commits. In feature order a
 * page is `limit` features with all their documents; the other orders page documents. A cursor that is gone answers
 * undefined.
 */
export async function listSpecs(source: ListSource, filter: SpecFilter, request: PageRequest) {
  const listed = await source.cache.documents.list(); const problems = listed.problems;
  const states = await documentStates(source, listed.documents);
  const documents = states.documents;
  const byId = new Map(documents.map(d => [d.id, d]));
  const arranged = arrangeDocuments(documents);
  let features = arranged.features;
  if (filter.feature !== undefined) {
    features = features.filter(f => f.index.feature === filter.feature);
    if (!features.length) throw new CommandError('UNKNOWN_FEATURE', t('docs.unknownFeature', { feature: filter.feature }));
  }
  const titled = (id: string): Titled => ({ id, title: byId.get(id)?.title ?? null });
  const designsOf = new Map<string, Titled[]>();
  for (const f of arranged.features) for (const d of f.designs) for (const r of d.requirements) designsOf.set(r, [...designsOf.get(r) ?? [], titled(d.id)]);

  const historyNeeded = filter.sort === 'updated' || filter.changedSince !== undefined || filter.author !== undefined || !!filter.withUpdated;
  const latest = new Map<string, Change>();
  // Each document's place in HEAD's history, newest first: the order of commits, not their dates, which may tie.
  const newest = new Map<string, number>();
  let touched: Set<string> | undefined;
  if (historyNeeded) {
    const head = await source.head();
    const changes = head ? await source.cache.history.changesOf(head) : [];
    changes.forEach((c, rank) => { if (!latest.has(c.id)) { latest.set(c.id, { commit: c.commit, date: c.date, author: c.author, email: c.email }); newest.set(c.id, rank); } });
    if (filter.changedSince !== undefined || filter.author !== undefined) {
      const after = await since(source, filter.changedSince, head); const by = byAuthor(filter.author);
      touched = new Set(changes.filter(c => after(c) && by(c)).map(c => c.id));
    }
  }
  const matched = filter.q !== undefined ? await source.cache.documents.matching(filter.q) : undefined;

  const rows = features.flatMap(f => [f.index, ...f.requirements, ...f.designs].filter(doc =>
    (filter.type === undefined || doc.kind === filter.type)
    && (!filter.withoutDesign || !f.designs.length)
    && (!filter.uncovered || (doc.kind === 'requirement' && !designsOf.has(doc.id)))
    && (!filter.draft || doc.draft)
    && (!touched || touched.has(doc.id))
    && (!matched || matched.has(doc.id)),
  ).map(doc => ({
    id: doc.id, kind: doc.kind as SpecKind, feature: (doc as FeatureDoc).feature, path: doc.path, title: doc.title, description: doc.description,
    ...(doc.kind === 'requirement' || doc.kind === 'design' ? { order: doc.order } : {}),
    ...(doc.draft ? { draft: true } : {}),
    state: states.state(doc.id), ...(states.previousPath(doc.id) ? { previousPath: states.previousPath(doc.id) } : {}),
    ...(doc.kind === 'design' ? { requirements: doc.requirements.map(titled), sources: titledSources(doc, byId) } : {}),
    ...(doc.kind === 'requirement' ? { designs: designsOf.get(doc.id) ?? [] } : {}),
    ...(historyNeeded ? { updated: latest.get(doc.id) ?? null } : {}),
    ...(matched ? { line: matched.get(doc.id)! } : {}),
  })));
  type Row = typeof rows[number];
  if (filter.sort === 'title') rows.sort((a, b) => a.title.localeCompare(b.title));
  // Newest change first; a document history has never seen (a new file) goes last.
  if (filter.sort === 'updated') rows.sort((a, b) => (newest.get(a.id) ?? Infinity) - (newest.get(b.id) ?? Infinity));
  // Feature order pages by feature, so a feature's documents are never split between two pages.
  const grouped = filter.sort === 'order';
  const groups = features.map(f => ({ id: f.index.id, rows: rows.filter(r => r.feature === f.index.feature) })).filter(g => g.rows.length);
  const page = grouped ? pageOf(groups, g => g.id, request) : pageOf(rows, r => r.id, request);
  if (!page) return undefined;
  const shown: Row[] = grouped ? (page.rows as typeof groups).flatMap(g => g.rows) : page.rows as Row[];
  return {
    rows: shown, features, byId, states, grouped, problems,
    page: { rows: page.rows, total: page.total, next: page.next }, unit: grouped ? 'feature' as const : 'document' as const,
    orphans: filter.feature === undefined ? arranged.orphans : [],
  };
}
export type SpecRow = NonNullable<Awaited<ReturnType<typeof listSpecs>>>['rows'][number];
