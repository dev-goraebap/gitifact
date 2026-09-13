import { mkdir, open, readFile, readdir, realpath, link, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { InitError, noteIdPattern, parseNote, validateNoteSet } from '@tryce/core';
import type { Note } from '@tryce/core';
import { configDirectory, fileInfo, readConfigFile } from './config-file.js';

export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const changed = () => new InitError('INPUT_CHANGED', '파일이나 디렉터리가 변경됐습니다. 다시 확인하세요.');
export async function regularDirectory(path: string) {
  const info = await fileInfo(path);
  if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new InitError('PATH_CONFLICT', '일반 디렉터리가 아닙니다: ' + path);
  return info;
}
async function guard(path: string) {
  const initial = await regularDirectory(path);
  if (!initial) throw changed();
  const canonical = await realpath(path);
  return async () => {
    const latest = await regularDirectory(path);
    if (!latest || latest.ino !== initial.ino || latest.dev !== initial.dev || await realpath(path) !== canonical) throw changed();
  };
}
export async function safeText(path: string) {
  const info = await fileInfo(path);
  if (!info || !info.isFile() || info.isSymbolicLink() || info.size > 65536) throw new InitError('PATH_CONFLICT', '64 KiB 이하의 일반 파일이 필요합니다: ' + path);
  const buffer = await readFile(path);
  const after = await fileInfo(path);
  if (!after || after.ino !== info.ino || after.dev !== info.dev || after.mtimeMs !== info.mtimeMs || buffer.length > 65536) throw changed();
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); }
  catch { throw new InitError('INVALID_NOTE', 'UTF-8 파일을 읽지 못했습니다.'); }
}

export async function readNotes(root: string) {
  await configDirectory(root);
  const path = join(root, '.tryce', 'notes');
  if (!await regularDirectory(path)) return { notes: [] as Note[], stamp: 'absent', paths: [] as string[], bytes: 0 };
  const check = await guard(path);
  const names = (await readdir(path)).sort();
  if (names.length > 1000) throw new InitError('NOTE_LIMIT', '첫 구현은 최대 1,000개 기록까지 읽습니다.');
  let bytes = 0; const notes: Note[] = []; const fingerprints: string[] = [];
  for (const name of names) {
    if (!name.endsWith('.json') || !noteIdPattern.test(name.slice(0, -5))) throw new InitError('UNKNOWN_NOTE_FILE', '알 수 없는 기록 파일을 보존했습니다: ' + name);
    const text = await safeText(join(path, name));
    bytes += Buffer.byteLength(text);
    if (bytes > 16 * 1024 * 1024) throw new InitError('NOTE_LIMIT', '기록 전체 크기가 16 MiB를 초과합니다.');
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new InitError('INVALID_NOTE', '기록 JSON을 읽지 못했습니다: ' + name); }
    const note = parseNote(value);
    if (name !== note.id + '.json') throw new InitError('NOTE_ID_CONFLICT', '파일명과 기록 ID가 다릅니다: ' + name);
    notes.push(note); fingerprints.push(name + ':' + digest(text));
  }
  await check();
  if (JSON.stringify(names) !== JSON.stringify((await readdir(path)).sort())) throw changed();
  validateNoteSet(notes);
  notes.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  return { notes, stamp: digest(fingerprints.join('\n')), paths: names.map(name => '.tryce/notes/' + name), bytes };
}

export async function withNoteLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  await configDirectory(root);
  const directory = join(root, '.tryce');
  const check = await guard(directory);
  const path = join(directory, '.notes.lock');
  let handle;
  try { handle = await open(path, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new InitError('PROJECT_BUSY', '기록 작업 잠금이 있습니다: .tryce/.notes.lock. 실행 중인 작업을 확인하세요. 중단된 작업이라면 잠금 파일만 수동 정리하세요.');
    throw error;
  }
  const owner = await handle.stat();
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, token: randomUUID() }) + '\n');
    await handle.close();
    await check();
    return await action();
  } finally {
    await handle.close();
    await check();
    const latest = await fileInfo(path);
    if (latest?.ino === owner.ino && latest.dev === owner.dev) await unlink(path);
  }
}

export async function publishNoteFile(root: string, relative: string, text: string, recheck: () => Promise<void>, replace = false) {
  const directory = join(root, '.tryce');
  const checkRoot = await guard(directory);
  const destination = join(root, relative);
  const parent = dirname(destination);
  await regularDirectory(parent);
  await mkdir(parent).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const checkParent = await guard(parent);
  const temporary = join(directory, '.write-' + randomUUID() + '.tmp');
  const handle = await open(temporary, 'wx', 0o600);
  const owner = await handle.stat();
  try {
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
    await recheck(); await checkRoot(); await checkParent();
    if (await safeText(temporary) !== text) throw changed();
    if (replace) await rename(temporary, destination);
    else await link(temporary, destination);
  } finally {
    await checkRoot();
    const current = await fileInfo(temporary);
    if (current?.ino === owner.ino && current.dev === owner.dev) await unlink(temporary);
  }
}

export async function preserveConfig(root: string, text: string, recheck: () => Promise<void>) {
  const relative = '.tryce/config.init-1.' + digest(text) + '.json';
  const path = join(root, relative);
  if (await fileInfo(path)) {
    if (await safeText(path) !== text) throw new InitError('BACKUP_CONFLICT', '기존 전환 원본이 일치하지 않습니다.');
  } else await publishNoteFile(root, relative, text, recheck);
  if (await readConfigFile(root) !== text) throw changed();
  return relative;
}
