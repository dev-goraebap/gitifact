import { randomBytes } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** A new ID: the kind's prefix and ten base32 characters. IDs are issued here only and never change. */
export const generateId = (prefix: 'S' | 'R' | 'D' | 'W' | 'I' | 'DR') => prefix + '-' + [...randomBytes(10)].map(n => 'abcdefghijklmnopqrstuvwxyz234567'[n & 31]).join('');

/**
 * Writes a new document file. The file must not exist yet; its folders are made as needed, but never through a link,
 * so a new document cannot land outside the project.
 */
export async function createDocumentFile(root: string, path: string, text: string): Promise<void> {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) {
    const folder = join(root, ...parts.slice(0, i));
    const info = await lstat(folder).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    if (!info) { await mkdir(folder); continue; }
    if (!info.isDirectory() || info.isSymbolicLink()) throw Object.assign(new Error(folder), { code: 'ENOTDIR' });
  }
  await writeFile(join(root, ...parts), text, { flag: 'wx' });
}

/** The attributes file init writes: every text file under .gitifact is stored and checked out with LF. */
export const LINE_ENDINGS_PATH = '.gitifact/.gitattributes';
const LINE_ENDINGS = '# Written by gitifact init: documents keep LF on every OS, so what Git holds and the files read the same.\n* text=auto eol=lf\n';

/**
 * Writes `.gitifact/.gitattributes` when it is missing. It applies inside .gitifact only, so the project's own
 * attributes stay as they are; an existing file is the user's and is kept. Answers whether the file was written.
 */
export async function writeLineEndings(root: string): Promise<boolean> {
  try { await createDocumentFile(root, LINE_ENDINGS_PATH, LINE_ENDINGS); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
}
