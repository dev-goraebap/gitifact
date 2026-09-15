import { open, readFile, mkdir, realpath, rename, link, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InitError } from '@gitifact/core';
import { fileInfo } from './config-file.js';

export async function skillPath(root: string, path: string, create = false) {
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
      throw new InitError('PATH_CONFLICT', '일반 경로가 아닙니다: ' + path);
    }
  }
  return full;
}
export async function skillRead(root: string, path: string) {
  const full = await skillPath(root, path);
  const before = await fileInfo(full);
  if (!before) return null;
  if (before.size > 65536) throw new InitError('SKILL_TOO_LARGE', '64 KiB를 초과합니다: ' + path);
  const bytes = await readFile(full);
  await skillPath(root, path);
  const after = await fileInfo(full);
  if (!after || before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || bytes.length > 65536) {
    throw new InitError('INPUT_CHANGED', '조회 중 파일이 변경됐습니다: ' + path);
  }
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new InitError('INVALID_SKILL', 'UTF-8 파일이어야 합니다: ' + path); }
}
export async function skillWrite(root: string, path: string, previous: string | null, next: string | null, recheck: () => Promise<void>) {
  const full = await skillPath(root, path, true);
  const directory = dirname(full);
  const owner = await fileInfo(directory);
  const canonical = await realpath(directory);
  const unchanged = async () => {
    await skillPath(root, path);
    const now = await fileInfo(directory);
    if (now?.ino !== owner?.ino || now?.dev !== owner?.dev || await realpath(directory) !== canonical) throw new InitError('INPUT_CHANGED', '스킬 경로가 변경됐습니다.');
  };
  if (next === null) {
    await recheck(); await unchanged();
    if (await skillRead(root, path) !== previous) throw new InitError('INPUT_CHANGED', '제거 대상이 변경됐습니다.');
    if (previous !== null) await unlink(full);
    return;
  }
  const temp = join(directory, '.gitifact-skill-' + randomUUID() + '.tmp');
  const handle = await open(temp, 'wx', 0o600);
  const tempOwner = await handle.stat();
  try {
    try { await handle.writeFile(next, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    await recheck(); await unchanged();
    if (await skillRead(root, path) !== previous || await readFile(temp, 'utf8') !== next) throw new InitError('INPUT_CHANGED', '게시 대상이 변경됐습니다.');
    if (previous === null) await link(temp, full); else await rename(temp, full);
  } finally {
    await unchanged();
    const now = await fileInfo(temp);
    if (now?.ino === tempOwner.ino && now.dev === tempOwner.dev) await unlink(temp);
  }
}
export async function skillLock<T>(root: string, path: string, action: () => Promise<T>) {
  const full = await skillPath(root, path, true);
  const handle = await open(full, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw new InitError('SKILLS_BUSY', '스킬 작업 잠금이 있습니다. 실행 상태를 확인하세요.');
    throw error;
  });
  const owner = await handle.stat(); await handle.close();
  try { return await action(); }
  finally {
    await skillPath(root, path);
    const now = await fileInfo(full);
    if (now?.ino === owner.ino && now.dev === owner.dev) await unlink(full);
  }
}
