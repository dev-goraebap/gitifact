import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyDocPath, isAssetPath } from '@gitifact/core';
import { LINE_ENDINGS_PATH } from '../adapters/filesystem/document-file.js';
import { CommandError } from './output.js';
import { t } from '../shared/i18n/index.js';

export const fail = (message: string): never => { throw new CommandError('INVALID_COMMIT', message); };
export const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
export const optional = (path: string) => readFile(path).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
export const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
/** A document or the reason file: what the commit reads, checks and binds to the staged bytes. */
export const record = (path: string) => { try { const type = classifyDocPath(path).type; return type !== 'ignored' && type !== 'instruction-file'; } catch { return false; } };
/** A file of an instruction folder besides its index.md: committed with the instruction, not parsed. */
const instructionFile = (path: string) => { try { return classifyDocPath(path).type === 'instruction-file'; } catch { return false; } };
export function validPath(path: string) {
  if (typeof path !== 'string' || path.length > 1000 || /[\\:\x00-\x1f\x7f]/.test(path)
    || path.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) fail(t('commitFiles.relativePath'));
}
export async function fingerprint(root: string, path: string) {
  validPath(path); const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const target = join(root, ...parts.slice(0, i)); const stat = await info(target);
    if (!stat) return null;
    if (stat.isSymbolicLink() || (i < parts.length ? !stat.isDirectory() : !stat.isFile())) fail(t('commitFiles.linkOrDirectory'));
    if (i < parts.length && await info(join(target, '.git'))) fail(t('commitFiles.nestedRepository'));
    if (i === parts.length) {
      if (stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) fail(t('commitFiles.hardLinkOrSize'));
      return hash(Buffer.concat([Buffer.from(String(stat.mode & 0o111) + '\0'), await readFile(target)]));
    }
  }
  return null;
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(t('commitFiles.invalidInput'));
  return input as Record<string, unknown>;
}
export function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) return fail(t('commitFiles.emptyOrTooLong'));
  return value;
}
export function paths(value: unknown, limit = 128): string[] {
  if (!Array.isArray(value) || !value.length || value.length > limit || value.some(p => typeof p !== 'string')) return fail(t('commitFiles.invalidPaths'));
  const list = [...new Set(value as string[])].sort(); list.forEach(validPath); return list;
}
export function policyPaths(files: string[]) {
  const all = new Set(['AGENTS.md', 'CLAUDE.md', '.gitignore', '.gitattributes', '.gitifact/config.json']);
  for (const file of files) { const parts = file.split('/'); for (let i = 1; i < parts.length; i++) for (const name of ['AGENTS.md', 'CLAUDE.md', '.gitignore', '.gitattributes']) all.add(parts.slice(0, i).join('/') + '/' + name); }
  return [...all].sort();
}
/** The store's own files besides documents: the configuration and the line-ending attributes init writes. */
const storeFiles = new Set(['.gitifact/config.json', LINE_ENDINGS_PATH]);
/** Inside `.gitifact` only documents, instruction files, the reason file, the store's own files and assets are committed; the cache never is. */
export function checkStoreSelection(selected: string[]) {
  for (const p of selected.filter(p => p.startsWith('.gitifact/') && !record(p) && !storeFiles.has(p))) {
    // Assets travel with the documents; they are committed, not parsed.
    if (!isAssetPath(p) && !instructionFile(p)) fail(t('commitFiles.notRecord', { path: p }));
  }
}
