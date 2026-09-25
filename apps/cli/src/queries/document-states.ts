import { classifyDocPath, parseDocumentFile, INSTRUCTIONS_ROOT, SPEC_ROOT, WIKI_ROOT, type Doc } from '@gitifact/core';
import type { StoreReader } from '../adapters/git/store-reader.js';

/** What a query reads the repository through: the commit HEAD points at and Git under the guarded environment. */
export interface QuerySource { head(): Promise<string | null>; reader: Pick<StoreReader, 'run' | 'decode' | 'blobs'> }

/**
 * Where a document stands against the last commit: committed as it is, added, modified (a move is one), or deleted
 * from the working tree and so gone with the next commit. Staged or not makes no difference; all of it is uncommitted.
 */
export type DocState = 'committed' | 'added' | 'modified' | 'deleted';
export interface DocumentStates {
  /** The working documents and, after them, the documents only the last commit still has. */
  documents: Doc[];
  state(id: string): DocState;
  /** Where a moved document was at the last commit. */
  previousPath(id: string): string | undefined;
}

const isDocument = (path: string) => { try { return classifyDocPath(path).type === 'doc'; } catch { return false; } };

/**
 * The states of the working documents from one `git status` over the document folders. Only the paths Git names are
 * looked at further: a deleted path is read at HEAD for the document it held, and a document found again at a new
 * path under the same ID is one modified document, not a deletion and an addition.
 */
export async function documentStates(project: QuerySource, working: Doc[]): Promise<DocumentStates> {
  const head = await project.head();
  const states = new Map<string, DocState>(); const previous = new Map<string, string>();
  const result = (documents: Doc[]): DocumentStates => ({ documents, state: id => states.get(id) ?? 'committed', previousPath: id => previous.get(id) });
  if (!head) { for (const doc of working) states.set(doc.id, 'added'); return result(working); }

  const status = project.reader.decode(await project.reader.run(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', ...[SPEC_ROOT, INSTRUCTIONS_ROOT, WIKI_ROOT].map(root => ':(top)' + root)]))
    .split('\0').filter(Boolean);
  const byPath = new Map(working.map(d => [d.path, d]));
  const added: Doc[] = []; const deletedPaths: string[] = [];
  for (const entry of status) {
    const [x, y] = [entry[0], entry[1]]; const path = entry.slice(3);
    if (!isDocument(path)) continue;
    const doc = byPath.get(path);
    // At HEAD unless Git calls it new; a path added to the index and then removed was never committed and is nothing.
    const atHead = x !== '?' && x !== 'A';
    // A file that is there but does not parse is a problem the lists report, not a deletion.
    if (!doc) { if (atHead && (x === 'D' || y === 'D')) deletedPaths.push(path); continue; }
    if (!atHead) { added.push(doc); continue; }
    if (x !== ' ' || y !== ' ') states.set(doc.id, 'modified');
  }
  const gone = await documentsAtHead(project, head, deletedPaths);
  const goneById = new Map(gone.map(d => [d.id, d]));
  for (const doc of added) {
    const before = goneById.get(doc.id);
    if (before) { states.set(doc.id, 'modified'); previous.set(doc.id, before.path); goneById.delete(doc.id); }
    else states.set(doc.id, 'added');
  }
  // A deleted document whose ID is still in the working tree was split or copied; the working one is what is listed.
  const ids = new Set(working.map(d => d.id));
  const deleted = [...goneById.values()].filter(d => !ids.has(d.id));
  for (const doc of deleted) states.set(doc.id, 'deleted');
  return result([...working, ...deleted]);
}

/** The documents the given paths held at HEAD, read from one tree listing and one batch of blobs. */
async function documentsAtHead(project: QuerySource, head: string, paths: string[]): Promise<Doc[]> {
  if (!paths.length) return [];
  const listing = project.reader.decode(await project.reader.run(['ls-tree', '--full-tree', '-z', head, '--', ...paths])).split('\0').filter(Boolean)
    .map(row => /^\d+ blob ([a-f0-9]+)\t([\s\S]+)$/.exec(row)).filter((m): m is RegExpExecArray => !!m).map(m => ({ blob: m[1]!, path: m[2]! }));
  const blobs = await project.reader.blobs([...new Set(listing.map(l => l.blob))]).catch(() => new Map<string, string>());
  return listing.flatMap(({ blob, path }) => {
    const text = blobs.get(blob);
    try { return text === undefined ? [] : [parseDocumentFile(path, text)]; } catch { return []; }
  });
}
