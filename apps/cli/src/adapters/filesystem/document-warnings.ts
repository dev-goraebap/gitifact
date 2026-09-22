import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ASSETS_DIR, documentBodyLinks, documentWarnings, type AssetFile, type Doc, type DocWarning } from '@gitifact/core';

const info = async (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const posix = (path: string) => path.split('\\').join('/');

/** Files under `.gitifact/assets`, repo-relative with sizes. Links and symlinks are skipped: they are not committed assets. */
export async function listAssets(root: string): Promise<AssetFile[]> {
  const out: AssetFile[] = [];
  async function visit(relative: string, depth: number) {
    const stat = await info(join(root, relative)); if (!stat || stat.isSymbolicLink()) return;
    if (stat.isDirectory()) { if (depth > 8 || out.length > 4000) return; for (const name of (await readdir(join(root, relative))).sort()) await visit(relative + '/' + name, depth + 1); }
    else if (stat.isFile()) out.push({ path: posix(relative), bytes: stat.size });
  }
  await visit(ASSETS_DIR, 0);
  return out;
}

/** Link and asset warnings for the working tree. A link outside `.gitifact` counts when it names a regular file there. */
export async function readDocumentWarnings(root: string, documents: readonly Doc[]): Promise<DocWarning[]> {
  const outside = [...new Set(documentBodyLinks(documents).map(l => l.target).filter(t => !t.startsWith('.gitifact/')))];
  const existing = new Set<string>();
  for (const target of outside) if ((await info(join(root, ...target.split('/'))))?.isFile()) existing.add(target);
  return documentWarnings(documents, await listAssets(root), existing);
}
