import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const LIMIT = 1024 * 1024;

/**
 * AGENTS.md at the repository root as text, for the browser to show beside the instructions it points at. A missing
 * file, a link, one over 1 MB or one that is not UTF-8 reads as none: the page then shows the instructions alone.
 */
export async function readAgentsFile(root: string): Promise<string | null> {
  const file = join(root, 'AGENTS.md');
  const info = await lstat(file).catch(() => undefined);
  if (!info?.isFile() || info.size > LIMIT) return null;
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(await readFile(file)); }
  catch { return null; }
}
