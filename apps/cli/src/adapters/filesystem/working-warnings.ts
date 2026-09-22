import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ASSETS_DIR, ASSET_SIZE_LIMIT, ASSETS_TOTAL_LIMIT, RECOMMENDED_ASSET_EXTENSIONS, assetExtension, documentLinks, designReferenceWarnings, type StoreBundle, type StoreWarning } from '@gitifact/core';

const info = async (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const posix = (path: string) => path.split('\\').join('/');

/** Files under `.gitifact/assets`, repo-relative with sizes. Links and symlinks are skipped: they are not committed assets. */
export async function listAssets(root: string): Promise<{ path: string; bytes: number }[]> {
  const out: { path: string; bytes: number }[] = [];
  async function visit(relative: string, depth: number) {
    const stat = await info(join(root, relative)); if (!stat || stat.isSymbolicLink()) return;
    if (stat.isDirectory()) { if (depth > 8 || out.length > 4000) return; for (const name of (await readdir(join(root, relative))).sort()) await visit(relative + '/' + name, depth + 1); }
    else if (stat.isFile()) out.push({ path: posix(relative), bytes: stat.size });
  }
  await visit(ASSETS_DIR, 0);
  return out;
}

/**
 * Advisory findings over the working tree: dangling relative links, assets over the recommended size or outside the
 * recommended extensions, and assets no record references. None of them blocks saving or committing.
 */
export async function workingWarnings(root: string, bundle: StoreBundle): Promise<StoreWarning[]> {
  const warnings: StoreWarning[] = designReferenceWarnings(bundle.specs);
  const records = new Set([...bundle.specs.flatMap(s => [s.path, ...(s.design ? [s.path.replace(/requirements\.md$/, 'design.md')] : [])]), ...bundle.wiki.documents.map(d => d.path)]);
  const assets = await listAssets(root); const assetPaths = new Set(assets.map(a => a.path));
  const referenced = new Set<string>();
  for (const { from, link, target } of documentLinks(bundle)) {
    if (records.has(target)) continue;
    if (assetPaths.has(target)) { referenced.add(target); continue; }
    // Anything else must exist as a regular file in the repository; the browser cannot open it but the link is still real.
    const stat = target.startsWith('.gitifact/') ? undefined : await info(join(root, ...target.split('/')));
    if (!stat?.isFile()) warnings.push({ code: 'MISSING_LINK_TARGET', path: from, target, link });
  }
  let total = 0;
  for (const asset of assets) {
    total += asset.bytes;
    if (asset.bytes > ASSET_SIZE_LIMIT) warnings.push({ code: 'ASSET_SIZE', path: asset.path, bytes: asset.bytes });
    if (!(RECOMMENDED_ASSET_EXTENSIONS as readonly string[]).includes(assetExtension(asset.path))) warnings.push({ code: 'ASSET_EXTENSION', path: asset.path });
    if (!referenced.has(asset.path)) warnings.push({ code: 'UNREFERENCED_ASSET', path: asset.path });
  }
  if (total > ASSETS_TOTAL_LIMIT) warnings.push({ code: 'ASSETS_TOTAL_SIZE', bytes: total });
  return warnings;
}
