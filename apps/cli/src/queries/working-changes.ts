import { checkDocuments, compareDocumentSets, parseDocumentFile, classifyDocPath, type DecisionRecord, type Doc, type DocChange } from '@gitifact/core';
import type { Cache } from '../adapters/cache/index.js';
import type { PendingRecords } from '../adapters/git/pending-records.js';

/** What the uncommitted work is read through: HEAD, the cache, and the records Git's status names as new. */
export interface WorkingSource { head(): Promise<string | null>; cache: Cache; pendingRecords(): Promise<PendingRecords> }

/**
 * The documents that differ from HEAD and the records written but not yet committed: what `changes list` and the
 * browser's uncommitted entry show. Worked out on every call from the files and HEAD; nothing of it is kept. A caller
 * that has read HEAD already (a commit, which checks it again later) passes it so both reads agree.
 */
export async function workingChanges(source: WorkingSource, known?: string | null) {
  const head = known !== undefined ? known : await source.head();
  const headFiles = head ? await source.cache.history.filesAt(head) : new Map<string, string>();
  const [working, records] = await Promise.all([source.cache.documents.files(), source.pendingRecords()]);
  return { head, headFiles, working, records, ...compareDocumentSets(headFiles, working.files) };
}

/**
 * The changes a record should explain and no record does. A new document carries its own why (a requirement's user
 * story), so only changing, moving or deleting what was there calls for one.
 */
export const uncovered = (changes: DocChange[], records: DecisionRecord[]) => {
  const covered = new Set(records.flatMap(r => r.docs));
  return changes.filter(c => c.types.some(type => type !== 'created') && !covered.has(c.id)).map(c => c.id);
};

/** The uncommitted work in the shape the browser shows: records with their sections, changes, and what lacks a record. */
export async function workingOverview(source: WorkingSource) {
  const found = await workingChanges(source);
  const records = checkDocuments(new Map([...found.working.files, ...found.records.files])).records;
  return {
    head: found.head,
    records: records.map(r => ({ id: r.id, title: r.title, docs: r.docs, sections: r.sections.map(s => ({ key: s.key, body: s.body })), draft: !!r.draft })),
    changes: found.changes.map(c => ({ id: c.id, kind: c.kind, title: c.title, path: c.path, ...(c.previousPath ? { previousPath: c.previousPath } : {}), types: c.types })),
    withoutRecord: uncovered(found.changes, records),
  };
}

/** A document as a change's side shows it, with the ID of the feature it belongs to (or its kind outside the specs). */
function snapshot(doc: Doc, docs: Doc[]) {
  const folder = doc.path.split('/').slice(0, 3).join('/');
  const specId = doc.kind === 'wiki' || doc.kind === 'instruction' ? doc.kind : docs.find(d => d.kind === 'feature' && d.path === folder + '/index.md')?.id ?? '';
  const base = { id: doc.id, kind: doc.kind, title: doc.title, description: doc.description, body: doc.body, specId, path: doc.path };
  if (doc.kind === 'requirement') return { ...base, order: doc.order };
  if (doc.kind === 'design') return { ...base, order: doc.order, requirements: doc.requirements, sources: doc.sources };
  return base;
}
const parsed = (files: ReadonlyMap<string, string>) => [...files].flatMap(([path, text]) => {
  try { return classifyDocPath(path).type === 'doc' ? [parseDocumentFile(path, text)] : []; } catch { return []; }
});

/** One uncommitted change with the document at HEAD and as the file is now, or undefined when nothing changed it. */
export async function workingChange(source: WorkingSource, id: string) {
  const found = await workingChanges(source);
  const change = found.changes.find(c => c.id === id);
  if (!change) return undefined;
  const before = parsed(found.headFiles); const after = parsed(found.working.files);
  const side = (docs: Doc[]) => { const doc = docs.find(d => d.id === id); return doc ? snapshot(doc, docs) : null; };
  return { change: { id: change.id, kind: change.kind, title: change.title, path: change.path, ...(change.previousPath ? { previousPath: change.previousPath } : {}), types: change.types },
    before: side(before), after: side(after) };
}
