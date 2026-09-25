import { DocumentError, docProblem, type Doc, type DocProblem, type DocProblemCode } from '../domain/document.js';
import { classifyDocPath, isInstructionReference, isWikiPage, parseDocumentFile, parseInstructionFile, INSTRUCTIONS_ROOT, INSTRUCTION_FILE, SPEC_ROOT } from '../formats/document-file.js';
import { extractLinks, resolveLink } from '../formats/links.js';
import { parseRecordFile } from '../formats/record-file.js';
import type { DecisionRecord } from '../domain/record.js';

export interface DocumentSet { documents: Doc[]; records: DecisionRecord[]; problems: DocProblem[] }

/**
 * Reads every document and record file and reports all problems instead of stopping at the first: a broken file is
 * reported and left out, and the rest is still checked against each other. The check covers the whole set because a
 * problem can sit in a file nobody changed — deleting an instruction leaves a design's `sources` pointing nowhere.
 */
export function checkDocuments(files: ReadonlyMap<string, string>): DocumentSet {
  const documents: Doc[] = []; const records: DecisionRecord[] = []; const problems: DocProblem[] = [];
  const report = (code: DocProblemCode, path: string, values: Record<string, unknown> = {}) => problems.push(docProblem(code, path, values));
  const features = new Set<string>(); const designFolders = new Map<string, boolean>();
  // Instruction folders, and whether each has its index.md; the other files of a folder only show that it exists.
  const instructionFolders = new Map<string, boolean>();
  // Instructions hold how the project works across features; a design names the instructions it follows, never the
  // other way round.
  const specLinks = (path: string, body: string) => {
    for (const link of extractLinks(body)) if (resolveLink(path, link)?.startsWith(SPEC_ROOT + '/')) report('INSTRUCTION_SPEC_LINK', path, { link });
  };
  for (const [path, source] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    // A page left from the wiki is not read as a document, so a design still naming it also reports the reference.
    if (isWikiPage(path)) { report('WIKI_REMOVED', path); continue; }
    try {
      const where = classifyDocPath(path);
      if (where.type === 'ignored') continue;
      // Records replaced the reason file; one left in the tree would hold reasons nothing reads.
      if (where.type === 'reasons') { report('REASONS_FILE_REMOVED', path); continue; }
      if (where.type === 'record') { records.push(parseRecordFile(path, source)); continue; }
      if (where.type === 'instruction-file') {
        instructionFolders.set(where.name, instructionFolders.get(where.name) === true);
        if (isInstructionReference(path)) { specLinks(path, source); parseInstructionFile(path, source); }
        continue;
      }
      if (where.kind === 'instruction') instructionFolders.set(where.name, true);
      if (where.kind === 'requirement' || where.kind === 'design') features.add(where.feature);
      if (where.kind === 'design') designFolders.set(where.feature, designFolders.get(where.feature) === true || where.slug === 'overview');
      documents.push(parseDocumentFile(path, source));
    } catch (error) {
      if (!(error instanceof DocumentError)) throw error;
      problems.push({ code: error.code, path: error.path, message: error.message });
    }
  }

  const byId = new Map<string, Doc>();
  for (const doc of documents) if (doc.draft) report('DOC_DRAFT', doc.path);
  for (const doc of documents) if (doc.kind === 'instruction') specLinks(doc.path, doc.body);
  for (const doc of documents) {
    const seen = byId.get(doc.id);
    if (seen) report('DUPLICATE_ID', doc.path, { id: doc.id, other: seen.path }); else byId.set(doc.id, doc);
  }
  for (const r of records) if (r.draft) report('DOC_DRAFT', r.path);
  // The file name is the ID, so the same ID can only repeat across day folders.
  const recordIds = new Map<string, string>();
  for (const r of records) {
    const seen = recordIds.get(r.id);
    if (seen) report('DUPLICATE_RECORD_ID', r.path, { id: r.id, other: seen }); else recordIds.set(r.id, r.path);
  }
  // Order sorts documents within one folder; two with the same number would have no defined order.
  const orders = new Map<string, Doc>();
  for (const doc of documents) {
    if (doc.kind !== 'requirement' && doc.kind !== 'design') continue;
    const key = `${doc.feature}/${doc.kind}/${doc.order}`;
    const seen = orders.get(key);
    if (seen) report('DUPLICATE_ORDER', doc.path, { order: doc.order, other: seen.path }); else orders.set(key, doc);
  }
  for (const doc of documents) {
    if (doc.kind !== 'design') continue;
    for (const id of doc.requirements) if (byId.get(id)?.kind !== 'requirement') report('MISSING_REFERENCE', doc.path, { id });
    for (const s of doc.sources) if ('id' in s && (!byId.has(s.id) || s.id === doc.id)) report('MISSING_REFERENCE', doc.path, { id: s.id });
  }
  const indexed = new Set(documents.filter(d => d.kind === 'feature').map(d => d.feature));
  const hasIndexFile = new Set([...files.keys()].map(p => /^\.gitifact\/spec\/([^/]+)\/index\.md$/.exec(p)?.[1]).filter(Boolean));
  for (const feature of features) if (!indexed.has(feature) && !hasIndexFile.has(feature)) report('FEATURE_INDEX_REQUIRED', `.gitifact/spec/${feature}/index.md`, { feature });
  for (const [feature, overview] of designFolders) if (!overview) report('DESIGN_OVERVIEW_REQUIRED', `.gitifact/spec/${feature}/design/overview.md`, { feature });
  for (const [name, hasFile] of instructionFolders) if (!hasFile) report('INSTRUCTION_INDEX_REQUIRED', `${INSTRUCTIONS_ROOT}/${name}/${INSTRUCTION_FILE}`);
  return { documents, records, problems };
}
