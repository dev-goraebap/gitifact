import type { DesignDoc, Doc, FeatureDoc, InstructionDoc, RequirementDoc, WikiDoc } from '../domain/document.js';

export interface ArrangedFeature { index: FeatureDoc; requirements: RequirementDoc[]; designs: DesignDoc[] }
export interface ArrangedDocuments {
  features: ArrangedFeature[];
  wiki: WikiDoc[];
  /** Instructions by folder name. */
  instructions: InstructionDoc[];
  /** Feature folders holding requirements or designs but no index.md: no feature ID to show them under. */
  orphans: string[];
}

const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const byOrder = (a: { order: number; path: string }, b: { order: number; path: string }) => a.order - b.order || byPath(a, b);

/**
 * The documents the way people read them: each feature with its requirements and designs in `order`, features by
 * folder name, the wiki by path and instructions by name. The list command and the browser both show this shape.
 */
export function arrangeDocuments(documents: readonly Doc[]): ArrangedDocuments {
  const folders = new Map<string, { index?: FeatureDoc; requirements: RequirementDoc[]; designs: DesignDoc[] }>();
  const folder = (name: string) => { let f = folders.get(name); if (!f) folders.set(name, f = { requirements: [], designs: [] }); return f; };
  const wiki: WikiDoc[] = []; const instructions: InstructionDoc[] = [];
  for (const doc of documents) {
    if (doc.kind === 'wiki') wiki.push(doc);
    else if (doc.kind === 'instruction') instructions.push(doc);
    else if (doc.kind === 'feature') folder(doc.feature).index = doc;
    else if (doc.kind === 'requirement') folder(doc.feature).requirements.push(doc);
    else folder(doc.feature).designs.push(doc);
  }
  const features: ArrangedFeature[] = []; const orphans: string[] = [];
  for (const [name, f] of [...folders].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!f.index) { orphans.push(name); continue; }
    features.push({ index: f.index, requirements: f.requirements.sort(byOrder), designs: f.designs.sort(byOrder) });
  }
  return { features, wiki: wiki.sort(byPath), instructions: instructions.sort(byPath), orphans };
}
