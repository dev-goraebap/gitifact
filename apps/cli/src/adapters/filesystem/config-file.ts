import { lstat, readFile, realpath, mkdir, open, link, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InitError, parseManagedConfig } from '@gitifact/core';
import { t } from '../../shared/i18n/index.js';

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
export const fileInfo = (path: string) => lstat(path).catch(error => { if (missing(error)) return undefined; throw error; });
export async function configDirectory(root: string) {
  const path = join(root, '.gitifact');
  const info = await fileInfo(path);
  if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new InitError('PATH_CONFLICT', t('config.storeNotDirectory'));
  return info;
}
export async function readConfigFile(root: string): Promise<string | undefined> {
  await configDirectory(root);
  const path = join(root, '.gitifact', 'config.json');
  const info = await fileInfo(path);
  if (!info) return undefined;
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) throw new InitError('PATH_CONFLICT', t('config.fileShape'));
  const bytes = await readFile(path);
  const after = await fileInfo(path);
  await configDirectory(root);
  if (!after || after.ino !== info.ino || after.dev !== info.dev || after.mtimeMs !== info.mtimeMs || bytes.length > 65536) {
    throw new InitError('INPUT_CHANGED', t('config.changedWhileReading'));
  }
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new InitError('INVALID_CONFIG', t('config.notUtf8Json')); }
}

// A hard link publishes the complete file without replacing an existing destination. `replace` renames the complete
// file over the existing one instead; the caller's recheck has confirmed that file is the one it means to replace.
export async function publishConfig(root: string, text: string, recheck: () => Promise<void>, beforePublish?: () => Promise<void>, replace = false) {
  const directory = join(root, '.gitifact');
  await configDirectory(root);
  await mkdir(directory).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const owner = await configDirectory(root);
  const canonical = await realpath(directory);
  const unchanged = async () => {
    const current = await configDirectory(root);
    if (!owner || !current || current.ino !== owner.ino || current.dev !== owner.dev || await realpath(directory) !== canonical) {
      throw new InitError('INPUT_CHANGED', t('config.directoryChanged'));
    }
  };
  const temporary = join(directory, '.init-' + randomUUID() + '.tmp');
  const handle = await open(temporary, 'wx', 0o600);
  const tempOwner = await handle.stat();
  try {
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally { await handle.close(); }
    await beforePublish?.();
    await unchanged();
    await recheck();
    await unchanged();
    const bytes = await readFile(temporary, 'utf8');
    if (bytes !== text) throw new InitError('INPUT_CHANGED', t('config.temporaryChanged'));
    parseManagedConfig(bytes);
    if (replace) await rename(temporary, join(directory, 'config.json'));
    else await link(temporary, join(directory, 'config.json'));
  } finally {
    // Never delete a replacement directory or a file introduced by another process.
    await unchanged();
    const current = await fileInfo(temporary);
    if (current?.ino === tempOwner.ino && current.dev === tempOwner.dev) await unlink(temporary);
  }
}
