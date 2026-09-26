import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * The nearest readable `.gitifact/config.json` at or above the folder, or undefined. It is a best-effort read for
 * reports and notices; checking the file is the commands' job.
 */
export async function findProjectConfig(from: string): Promise<{ root: string; text: string } | undefined> {
  for (let folder = from; ; folder = dirname(folder)) {
    const text = await readFile(join(folder, '.gitifact', 'config.json'), 'utf8').catch(() => undefined);
    if (text !== undefined) return { root: folder, text };
    if (dirname(folder) === folder) return undefined;
  }
}
