import type { Doc, DocKind, DocReason } from '../domain/document.js';
import { classifyDocPath, parseDocumentFile, parseReasonLines } from '../formats/document-file.js';

export type DocChangeType = 'created' | 'modified' | 'moved' | 'deleted';
/** One document that differs between two sets, named by its newer side (the older one when it was deleted). */
export interface DocChange { id: string; kind: DocKind; types: DocChangeType[]; title: string; path: string; previousPath?: string }

interface Side { docs: Map<string, { doc: Doc; text: string }>; reasons: Map<string, DocReason>; reasonsUnreadable: boolean }

/** The readable documents and reasons of a file set. A file that does not parse is left out; the check reports it. */
function sideOf(files: ReadonlyMap<string, string>): Side {
  const side: Side = { docs: new Map(), reasons: new Map(), reasonsUnreadable: false };
  for (const [path, source] of files) {
    try {
      const where = classifyDocPath(path);
      if (where.type === 'reasons') {
        try { for (const r of parseReasonLines(path, source)) side.reasons.set(r.id, r); } catch (error) { side.reasonsUnreadable = true; throw error; }
        continue;
      }
      if (where.type !== 'doc') continue;
      // A CRLF checkout of an LF file is the same document.
      const doc = parseDocumentFile(path, source);
      side.docs.set(doc.id, { doc, text: source.replace(/\r\n/g, '\n') });
    } catch { /* unreadable: reported by the check, not a change by ID */ }
  }
  return side;
}

/**
 * What changed from `before` to `after` (path → text), by document ID: a new path is a move, other text a
 * modification. Reasons are the lines `after` has and `before` does not — written but not yet committed.
 * `altered` names the reasons of `before` that `after` rewrote or dropped: a committed reason is never changed.
 */
export function compareDocumentSets(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): { changes: DocChange[]; reasons: DocReason[]; altered: string[] } {
  const from = sideOf(before); const to = sideOf(after);
  const changes: DocChange[] = [];
  for (const id of [...new Set([...from.docs.keys(), ...to.docs.keys()])].sort()) {
    const a = from.docs.get(id); const b = to.docs.get(id);
    const types: DocChangeType[] = [];
    if (!a) types.push('created'); else if (!b) types.push('deleted');
    else { if (a.doc.path !== b.doc.path) types.push('moved'); if (a.text !== b.text) types.push('modified'); }
    if (!types.length) continue;
    const named = (b ?? a)!.doc;
    changes.push({ id, kind: named.kind, types, title: named.title, path: named.path, ...(a && b && a.doc.path !== b.doc.path ? { previousPath: a.doc.path } : {}) });
  }
  // A reason file that does not parse is the check's REASON_INVALID, not every committed reason gone.
  const altered = to.reasonsUnreadable ? [] : [...from.reasons.values()].filter(r => { const kept = to.reasons.get(r.id); return !kept || JSON.stringify(kept) !== JSON.stringify(r); }).map(r => r.id).sort();
  return { changes, reasons: [...to.reasons.values()].filter(r => !from.reasons.has(r.id)), altered };
}
