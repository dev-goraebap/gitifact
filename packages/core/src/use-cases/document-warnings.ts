import { docWarning, type Doc, type DocWarning } from '../domain/document.js';
import { INSTRUCTIONS_ROOT } from '../formats/document-file.js';
import { ASSETS_DIR, ASSET_SIZE_LIMIT, ASSETS_TOTAL_LIMIT, RECOMMENDED_ASSET_EXTENSIONS, assetExtension, extractLinks, resolveLink,
  type DocumentLink } from '../formats/links.js';

export interface AssetFile { path: string; bytes: number }
/** How many `##` sections a design's overview.md holds before it is worth splitting into axis files. */
export const OVERVIEW_SECTION_LIMIT = 7;

/** Every relative link in the bodies of the documents, resolved to a repo-relative path. */
export function documentBodyLinks(documents: readonly Doc[]): DocumentLink[] {
  return documents.flatMap(doc => extractLinks(doc.body).flatMap(link => {
    const target = resolveLink(doc.path, link);
    return target === null ? [] : [{ from: doc.path, link, target }];
  }));
}

/**
 * Advisory findings over the working tree: relative links whose target is not a document, an asset or an existing
 * repository file, assets over the recommended size or outside the recommended extensions, assets no document
 * links to, and a design overview grown to seven sections or more. `existing` holds the link targets outside `.gitifact`, and the files of instruction folders, that the caller
 * found as regular files.
 */
export function documentWarnings(documents: readonly Doc[], assets: readonly AssetFile[], existing: ReadonlySet<string>): DocWarning[] {
  const warnings: DocWarning[] = [];
  const records = new Set(documents.map(d => d.path)); const assetPaths = new Set(assets.map(a => a.path));
  const referenced = new Set<string>();
  for (const { from, link, target } of documentBodyLinks(documents)) {
    if (records.has(target)) continue;
    if (assetPaths.has(target)) { referenced.add(target); continue; }
    if ((!target.startsWith('.gitifact/') || target.startsWith(INSTRUCTIONS_ROOT + '/')) && existing.has(target)) continue;
    warnings.push(docWarning('MISSING_LINK_TARGET', from, { link, target }));
  }
  let total = 0;
  for (const asset of assets) {
    total += asset.bytes;
    if (asset.bytes > ASSET_SIZE_LIMIT) warnings.push(docWarning('ASSET_SIZE', asset.path, { bytes: asset.bytes }));
    if (!(RECOMMENDED_ASSET_EXTENSIONS as readonly string[]).includes(assetExtension(asset.path))) warnings.push(docWarning('ASSET_EXTENSION', asset.path));
    if (!referenced.has(asset.path)) warnings.push(docWarning('UNREFERENCED_ASSET', asset.path));
  }
  if (total > ASSETS_TOTAL_LIMIT) warnings.push(docWarning('ASSETS_TOTAL_SIZE', ASSETS_DIR, { bytes: total }));
  for (const doc of documents) {
    if (doc.kind !== 'design' || !doc.path.endsWith('/design/overview.md')) continue;
    const sections = lines(doc.body).filter(line => /^##\s/.test(line)).length;
    if (sections >= OVERVIEW_SECTION_LIMIT) warnings.push(docWarning('DESIGN_OVERVIEW_LARGE', doc.path, { sections }));
  }
  return warnings;
}

const lines = (body: string) => body.replace(/\r\n/g, '\n').split('\n');
// The requirement sections in either language the guides write.
const scopeHeading = /^###\s+(?:범위와 제약|scope and constraints)\s*$/i;
const acceptanceHeading = /^###\s+(?:수용 조건|acceptance criteria)\s*$/i;

/**
 * Where a requirement body leaves the shape the spec guide sets: the scope section, when there is one, comes before
 * the acceptance criteria and holds `-` items only; the acceptance criteria hold numbered items only. Lines indented
 * under an item continue it. Advice, not a problem: the changes commands give it for the requirements they carry, so a
 * requirement is brought into shape when it is revised rather than all at once.
 */
export function requirementFormatWarnings(doc: Doc): DocWarning[] {
  if (doc.kind !== 'requirement') return [];
  const body = lines(doc.body);
  const scope = body.findIndex(line => scopeHeading.test(line.trim()));
  const acceptance = body.findIndex(line => acceptanceHeading.test(line.trim()));
  // The lines of the section a heading starts, up to the next heading of the same or a higher level.
  const sectionOf = (start: number) => { const rest = body.slice(start + 1); const end = rest.findIndex(line => /^#{1,3}\s/.test(line)); return end < 0 ? rest : rest.slice(0, end); };
  const outside = (section: string[], item: RegExp) => section.some(line => line.trim() !== '' && !item.test(line) && !/^\s+\S/.test(line));
  const warnings: DocWarning[] = [];
  if (scope >= 0 && ((acceptance >= 0 && scope > acceptance) || outside(sectionOf(scope), /^- /))) warnings.push(docWarning('REQUIREMENT_SCOPE_FORMAT', doc.path));
  if (acceptance >= 0 && (outside(sectionOf(acceptance), /^\d+\.\s/) || body.slice(acceptance + 1).some(line => /^#{1,3}\s/.test(line) && !scopeHeading.test(line.trim()))))
    warnings.push(docWarning('REQUIREMENT_CRITERIA_FORMAT', doc.path));
  return warnings;
}
