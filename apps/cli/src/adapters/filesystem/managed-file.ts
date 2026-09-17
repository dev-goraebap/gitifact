import { open, readFile, mkdir, realpath, rename, link, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InitError } from '@gitifact/core';
import { fileInfo } from './config-file.js';
import { t } from '../../shared/i18n/index.js';

// Repo-relative text files that the CLI publishes atomically while preserving concurrent user edits.
const DEFAULT_LIMIT = 1024 * 1024;
export async function managedPath(root: string, path: string, create = false) {
  let full = root;
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    full = join(full, parts[i]!);
    let info = await fileInfo(full);
    if (!info && create && i < parts.length - 1) {
      await mkdir(full).catch(error => { if (error.code !== 'EEXIST') throw error; });
      info = await fileInfo(full);
    }
    if (info && (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile()))) {
      throw new InitError('PATH_CONFLICT', t('managedFile.notRegularPath', { path }));
    }
  }
  return full;
}
export async function managedRead(root: string, path: string, limit = DEFAULT_LIMIT) {
  const full = await managedPath(root, path);
  const before = await fileInfo(full);
  if (!before) return null;
  if (before.size > limit) throw new InitError('FILE_TOO_LARGE', t('managedFile.tooLarge', { kib: limit / 1024, path }));
  const bytes = await readFile(full);
  await managedPath(root, path);
  const after = await fileInfo(full);
  if (!after || before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || bytes.length > limit) {
    throw new InitError('INPUT_CHANGED', t('managedFile.changedWhileReading', { path }));
  }
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new InitError('INVALID_UTF8', t('managedFile.notUtf8', { path })); }
}
export async function managedWrite(root: string, path: string, previous: string | null, next: string | null, recheck: () => Promise<void>) {
  const full = await managedPath(root, path, true);
  const directory = dirname(full);
  const owner = await fileInfo(directory);
  const canonical = await realpath(directory);
  const unchanged = async () => {
    await managedPath(root, path);
    const now = await fileInfo(directory);
    if (now?.ino !== owner?.ino || now?.dev !== owner?.dev || await realpath(directory) !== canonical) throw new InitError('INPUT_CHANGED', t('managedFile.targetChanged', { path }));
  };
  if (next === null) {
    await recheck(); await unchanged();
    if (await managedRead(root, path) !== previous) throw new InitError('INPUT_CHANGED', t('managedFile.removeTargetChanged', { path }));
    if (previous !== null) await unlink(full);
    return;
  }
  const temp = join(directory, '.gitifact-managed-' + randomUUID() + '.tmp');
  const handle = await open(temp, 'wx', 0o600);
  const tempOwner = await handle.stat();
  try {
    try { await handle.writeFile(next, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    await recheck(); await unchanged();
    if (await managedRead(root, path) !== previous || await readFile(temp, 'utf8') !== next) throw new InitError('INPUT_CHANGED', t('managedFile.publishTargetChanged', { path }));
    if (previous === null) await link(temp, full); else await rename(temp, full);
  } finally {
    await unchanged();
    const now = await fileInfo(temp);
    if (now?.ino === tempOwner.ino && now.dev === tempOwner.dev) await unlink(temp);
  }
}
