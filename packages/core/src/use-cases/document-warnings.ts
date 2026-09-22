import { docWarning, type Doc, type DocWarning } from '../domain/document.js';
import { ASSETS_DIR, ASSET_SIZE_LIMIT, ASSETS_TOTAL_LIMIT, RECOMMENDED_ASSET_EXTENSIONS, assetExtension, extractLinks, resolveLink,
  type DocumentLink } from '../formats/links.js';

export interface AssetFile { path: string; bytes: number }

/** Every relative link in the bodies of the documents, resolved to a repo-relative path. */
export function documentBodyLinks(documents: readonly Doc[]): DocumentLink[] {
  return documents.flatMap(doc => extractLinks(doc.body).flatMap(link => {
    const target = resolveLink(doc.path, link);
    return target === null ? [] : [{ from: doc.path, link, target }];
  }));
}

/**
 * Advisory findings over the working tree: relative links whose target is not a document, an asset or an existing
 * repository file, assets over the recommended size or outside the recommended extensions, and assets no document
 * links to. `existing` holds the link targets outside `.gitifact` that the caller found as regular files.
 */
export function documentWarnings(documents: readonly Doc[], assets: readonly AssetFile[], existing: ReadonlySet<string>): DocWarning[] {
  const warnings: DocWarning[] = [];
  const records = new Set(documents.map(d => d.path)); const assetPaths = new Set(assets.map(a => a.path));
  const referenced = new Set<string>();
  for (const { from, link, target } of documentBodyLinks(documents)) {
    if (records.has(target)) continue;
    if (assetPaths.has(target)) { referenced.add(target); continue; }
    if (!target.startsWith('.gitifact/') && existing.has(target)) continue;
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
  return warnings;
}
