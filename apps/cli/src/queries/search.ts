import type { ListSource } from './specs.js';

/** The groups the search box shows, in this order. */
export const SEARCH_GROUPS = ['feature', 'requirement', 'design', 'instruction', 'record', 'commit'] as const;
export type SearchGroup = typeof SEARCH_GROUPS[number];
/** Hits a group shows before the reader asks for more of it, and how many the opening list shows. */
const FIRST = 5; const RECENT = 6;

export interface SearchHit { id: string; kind: SearchGroup; title: string; where: string; line: string; featureId?: string; commit?: string }
export interface SearchResult { group: SearchGroup | 'recent'; total: number; next: string | null; hits: SearchHit[] }
export interface SearchRequest { q: string; head?: string | undefined; group?: SearchGroup | undefined; after?: string | undefined; limit?: number | undefined }

const place = (path: string) => path.replace(/^\.gitifact\//, '');
const folderOf = (path: string) => path.split('/').slice(0, 3).join('/');

/**
 * What the search box shows, worked out here so the browser only draws it. Nothing typed: the features and
 * instructions touched most recently. Words: each group's first hits and how many it has — the current documents by
 * kind, the records of HEAD's history one per record file, and the commits a hash names. With `group` only that group,
 * a page after the hit `after`. A cursor that no longer matches answers undefined.
 */
export async function searchRecords(source: ListSource, request: SearchRequest): Promise<SearchResult[] | undefined> {
  const head = request.head ?? await source.head();
  const query = request.q.trim().toLowerCase();
  if (!query) return [await recent(source, head)];
  const size = request.group ? request.limit ?? 20 : FIRST;
  const one = async (group: SearchGroup) => {
    const found = group === 'record' ? head ? await source.cache.history.searchRecords(head, query, request.after, size) : empty()
      : group === 'commit' ? head ? await source.cache.log.commitsNamed(head, query, request.after, size) : empty()
      : await source.cache.documents.searchKind(group, query, request.after, size);
    return found && { group, ...found };
  };
  const groups = await Promise.all((request.group ? [request.group] : SEARCH_GROUPS).map(one));
  if (groups.some(g => !g)) return undefined;
  return (groups as SearchResult[]).filter(g => request.group || g.total > 0);
}
const empty = () => ({ total: 0, next: null, hits: [] as SearchHit[] });

/** The features and instructions touched most recently, by the newest commit in their folder. */
async function recent(source: ListSource, head: string | null): Promise<SearchResult> {
  const [{ documents }, folders] = await Promise.all([source.cache.documents.list(), head ? source.cache.log.folders(head) : new Map()]);
  const hits = documents.filter(d => d.kind === 'feature' || d.kind === 'instruction')
    .map(d => ({ doc: d, latest: folders.get(folderOf(d.path))?.latest as string | undefined }))
    .filter((d): d is { doc: typeof d.doc; latest: string } => !!d.latest)
    .sort((a, b) => Date.parse(b.latest) - Date.parse(a.latest) || a.doc.id.localeCompare(b.doc.id))
    .slice(0, RECENT)
    .map(({ doc }): SearchHit => ({ id: doc.id, kind: doc.kind as 'feature' | 'instruction', title: doc.title, where: place(doc.path), line: doc.description,
      ...(doc.kind === 'feature' ? { featureId: doc.id } : {}) }));
  return { group: 'recent', total: hits.length, next: null, hits };
}
