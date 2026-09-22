// Relative links in document bodies and the asset folder they point into. Links are prose, never structure: they are
// read only to warn about broken targets and to tell which assets are used.

/** Files documents reference (images, PDFs, ...). They are committed with the documents but never parsed as records. */
export const ASSETS_DIR = '.gitifact/assets';
/** Extensions the browser previews inline; anything else is offered as a download and reported as a warning. */
export const RECOMMENDED_ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf'] as const;
export const ASSET_SIZE_LIMIT = 1024 * 1024;
export const ASSETS_TOTAL_LIMIT = 50 * 1024 * 1024;

const segmentOk = (part: string) => !!part && part !== '.' && part !== '..' && !/[\\:\0]/.test(part);
/** A file under `.gitifact/assets`: any name, no traversal, no store paths. */
export function isAssetPath(path: string): boolean {
  if (!path.startsWith(ASSETS_DIR + '/')) return false;
  const parts = path.slice(ASSETS_DIR.length + 1).split('/');
  return parts.every(segmentOk) && parts.length <= 8 && path.length <= 300;
}
export const assetExtension = (path: string) => (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? '').toLowerCase();

export interface DocumentLink { from: string; link: string; target: string }
/** Resolves a relative link against the directory of the document; absolute, external, anchor and mail links are not returned. */
export function resolveLink(from: string, link: string): string | null {
  const bare = link.replace(/[?#].*$/, '');
  if (!bare || /^[a-z][a-z0-9+.-]*:/i.test(bare) || bare.startsWith('/') || bare.startsWith('//')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const part of decodeSafe(bare).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); continue; }
    if (/[\\:\0]/.test(part)) return null;
    parts.push(part);
  }
  return parts.join('/');
}
const decodeSafe = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
/** Markdown links and images in a body, outside fenced code. Reference-style and autolinks are not collected. */
export function extractLinks(body: string): string[] {
  const links: string[] = []; let fence: {char: string; size: number} | undefined;
  for (const line of body.split('\n')) {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; continue; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; continue; }
    for (const m of line.replace(/`[^`]*`/g, '').matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\)/g)) links.push((m[1] ?? m[2])!);
  }
  return links;
}
