import type { ListSource } from './specs.js';
import { pageOf, type PageRequest } from './paging.js';

/**
 * One document's decision flow: every commit of `head` that changed it, newest first, with the records that explain
 * each change. The document is named by what the working tree holds, or by its last change once it is gone. A document
 * neither holds nor any commit changed answers undefined. The CLI's `records list --doc` and the browser's document
 * history page both read it here.
 */
export async function documentHistory(source: Pick<ListSource, 'cache'>, head: string | null, id: string) {
  const events = head ? await source.cache.history.ofDocument(head, id) : [];
  const current = (await source.cache.documents.list()).documents.find(d => d.id === id);
  const last = events.map(e => e.after ?? e.before).find(Boolean);
  if (!current && !events.length) return undefined;
  const doc = { id, title: current?.title ?? last?.title ?? null, kind: current?.kind ?? events[0]?.kind ?? null, path: current?.path ?? last?.path ?? null };
  return { doc, events };
}

/**
 * The browser's page of it: whole commits a page at a time, and counted over all of them, how many commits a record
 * explains and how many changed the document without one (adding it needs none).
 */
export async function documentHistoryPage(source: Pick<ListSource, 'cache'>, head: string | null, id: string, request: PageRequest) {
  const found = await documentHistory(source, head, id);
  if (!found) return undefined;
  const page = pageOf(found.events, e => e.commit, request);
  if (!page) return null;
  const recorded = found.events.filter(e => e.records.length).length;
  const withoutRecord = found.events.filter(e => !e.records.length && e.types.some(type => type !== 'created')).length;
  return { doc: found.doc, total: page.total, recorded, withoutRecord, next: page.next, events: page.rows };
}
