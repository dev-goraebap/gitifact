import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docProblem, isRecordFolder, recordIdOf, RECORDS_ROOT, type DocProblem } from '@gitifact/core';

type Run = (args: string[]) => Promise<Buffer>;
/**
 * The records not committed yet, found from Git's status rather than by reading every record: records are written
 * once, so the committed ones never need reading again. `files` holds the new ones (path → text) for the check and the
 * commit; `altered` names committed records that were edited or deleted, which a commit refuses.
 */
export interface PendingRecords { files: Map<string, string>; altered: string[]; problems: DocProblem[] }

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const info = (path: string) => lstat(path).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });

/** The day folders under `.gitifact/records`, for the one check that looks past the new files: an ID used on another day. */
export async function recordFolders(root: string): Promise<string[]> {
  return (await readdir(join(root, ...RECORDS_ROOT.split('/'))).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).filter(isRecordFolder);
}
/** The path of a record in the working tree, looked up in each day folder, or undefined. */
export async function findRecord(root: string, id: string): Promise<string | undefined> {
  for (const folder of await recordFolders(root)) {
    const path = `${RECORDS_ROOT}/${folder}/${id}.md`;
    if ((await info(join(root, ...path.split('/'))))?.isFile()) return path;
  }
  return undefined;
}

export async function readPendingRecords(root: string, run: Run): Promise<PendingRecords> {
  const status = (await run(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', RECORDS_ROOT])).toString('utf8').split('\0').filter(Boolean);
  const files = new Map<string, string>(); const altered: string[] = []; const problems: DocProblem[] = [];
  for (const entry of status) {
    const state = entry.slice(0, 2); const path = entry.slice(3);
    if (state !== '??' && !state.includes('A')) { altered.push(path); continue; }
    const file = join(root, ...path.split('/')); const stat = await info(file);
    if (!stat?.isFile() || stat.isSymbolicLink()) { problems.push(docProblem('PATH_UNSUPPORTED', path)); continue; }
    if (stat.size > 1024 * 1024) { problems.push(docProblem('FILE_TOO_LARGE', path)); continue; }
    try { files.set(path, decoder.decode(await readFile(file))); } catch { problems.push(docProblem('INVALID_CHARACTERS', path)); }
  }
  // The file name is the ID, so a new record can only repeat an ID from another day's folder.
  const folders = await recordFolders(root);
  for (const path of files.keys()) {
    const id = recordIdOf(path); if (!id) continue;
    for (const folder of folders) {
      const other = `${RECORDS_ROOT}/${folder}/${id}.md`;
      if (other !== path && !files.has(other) && (await info(join(root, ...other.split('/'))))?.isFile()) problems.push(docProblem('DUPLICATE_RECORD_ID', path, { id, other }));
    }
  }
  return { files, altered: altered.sort(), problems };
}
