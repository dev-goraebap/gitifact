import { docWarning, type Doc, type DocWarning, type RequirementStyle } from '../domain/document.js';
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
// The sections of a use-case requirement in the order they are written; the basic flow and the criteria are required.
const useCaseSections: [string, RegExp][] = [
  ['scope', scopeHeading],
  ['preconditions', /^###\s+(?:사전 조건|preconditions)\s*$/i],
  ['basic', /^###\s+(?:기본 흐름|basic flow)\s*$/i],
  ['alternatives', /^###\s+(?:대체 흐름|alternative flows?)\s*$/i],
  ['postconditions', /^###\s+(?:사후 조건|postconditions)\s*$/i],
  ['acceptance', acceptanceHeading],
];
// A criterion's path line, and the flows a path may name: the basic flow, or an alternative flow the requirement defines.
const pathLine = /^\s*(?:경로|path)\s*:\s*(.*)$/i;
const basicFlowName = /^(?:기본 흐름|basic flow)$/i;
const alternativeId = /^-\s+(?:\*\*)?(A\d+)\b/;

/**
 * Where a requirement body leaves the shape the spec guide sets: the scope section, when there is one, comes before
 * the acceptance criteria and holds `-` items only; the acceptance criteria hold numbered items only. Lines indented
 * under an item continue it. Advice, not a problem: the changes commands give it for the requirements they carry, so a
 * requirement is brought into shape when it is revised rather than all at once.
 */
export function requirementFormatWarnings(doc: Doc, projectStyle?: RequirementStyle): DocWarning[] {
  if (doc.kind !== 'requirement') return [];
  // A project that writes use cases names each requirement's style, so one left out is caught before its checks are skipped.
  const missing = projectStyle === 'usecase' && !doc.style ? [docWarning('REQUIREMENT_STYLE_MISSING', doc.path)] : [];
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
  if (doc.style === 'usecase') warnings.push(...useCaseWarnings(doc.path, body, sectionOf, acceptance));
  return [...missing, ...warnings];
}

/**
 * A use-case requirement: a basic flow, the known sections in their order, and a path on every criterion that names
 * only the basic flow and the alternative flows the requirement defines.
 */
function useCaseWarnings(path: string, body: string[], sectionOf: (start: number) => string[], acceptance: number): DocWarning[] {
  const warnings: DocWarning[] = [];
  const found = useCaseSections.map(([key, heading]) => ({ key, at: body.findIndex(line => heading.test(line.trim())) })).filter(s => s.at >= 0);
  const ordered = found.every((s, i) => i === 0 || s.at > found[i - 1]!.at);
  if (!found.some(s => s.key === 'basic') || !ordered) warnings.push(docWarning('REQUIREMENT_FLOW_FORMAT', path));
  if (acceptance < 0) return warnings;
  const alternatives = found.find(s => s.key === 'alternatives');
  const defined = new Set(alternatives ? sectionOf(alternatives.at).flatMap(line => { const m = alternativeId.exec(line); return m ? [m[1]!] : []; }) : []);
  // Each criterion: a numbered item and the lines indented under it.
  const items: string[][] = [];
  for (const line of sectionOf(acceptance)) {
    if (/^\d+\.\s/.test(line)) items.push([line.replace(/^\d+\.\s+/, '')]);
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1]!.push(line);
  }
  const named = (flow: string) => basicFlowName.test(flow) || defined.has(flow);
  const unpathed = items.some(item => {
    const match = item.map(line => pathLine.exec(line)).find(Boolean);
    const flows = match ? match[1]!.split(/[,，、]/).map(f => f.trim()).filter(Boolean) : [];
    return !flows.length || !flows.every(named);
  });
  if (unpathed) warnings.push(docWarning('REQUIREMENT_PATH_FORMAT', path));
  return warnings;
}
