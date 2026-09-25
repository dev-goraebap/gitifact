import { lstat, open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTRUCTION_FILE } from '@gitifact/core';

// The files of one instruction folder in the working tree, for `instructions show` and the browser. Links are neither listed
// nor followed: a folder that points elsewhere would let a read leave the project.

/** How many files a folder lists; an instruction with more is marked as limited. */
export const INSTRUCTION_FILE_LIMIT = 500;
/** The largest file the browser is sent as text. */
export const INSTRUCTION_TEXT_LIMIT = 512 * 1024;

const folderOf = (root: string, instructionPath: string) => join(root, ...instructionPath.split('/').slice(0, -1));

/** The files beside index.md, relative to the folder and sorted, with their sizes. */
export async function listInstructionFiles(root: string, instructionPath: string): Promise<{ files: { path: string; size: number }[]; limited: boolean }> {
  const files: { path: string; size: number }[] = [];
  let limited = false;
  async function visit(folder: string, prefix: string, depth: number): Promise<void> {
    if (depth > 10) return;
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (files.length >= INSTRUCTION_FILE_LIMIT) { limited = true; return; }
      const path = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(folder, entry.name), path + '/', depth + 1);
      else if (entry.isFile() && path !== INSTRUCTION_FILE) files.push({ path, size: (await lstat(join(folder, entry.name))).size });
    }
  }
  await visit(folderOf(root, instructionPath), '', 0);
  return { files, limited };
}

/** How much of a Markdown file is read to find its title: a title comes first, so the start of the file is enough. */
const HEADING_WINDOW = 8 * 1024;

/**
 * The title of each Markdown file in the list: its first `# ` heading, found in the first few kilobytes outside code
 * fences, or none. The browser names a reference by it instead of by its file name.
 */
export async function withTitles(root: string, instructionPath: string, files: { path: string; size: number }[]) {
  const folder = folderOf(root, instructionPath);
  return Promise.all(files.map(async file => {
    if (!file.path.toLowerCase().endsWith('.md')) return file;
    let handle;
    try {
      handle = await open(join(folder, ...file.path.split('/')), 'r');
      const buffer = Buffer.alloc(Math.min(HEADING_WINDOW, file.size));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      let fenced = false;
      for (const line of buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/)) {
        if (/^\s{0,3}(```|~~~)/.test(line)) fenced = !fenced;
        const heading = !fenced && /^#\s+(.+?)\s*#*\s*$/.exec(line);
        if (heading) return { ...file, title: heading[1]!.slice(0, 200) };
      }
      return file;
    } catch { return file; }
    finally { await handle?.close(); }
  }));
}

/**
 * One file of an instruction folder by its path inside the folder, or undefined when there is no such plain file. A file
 * over the text limit or one that is not UTF-8 text comes back without its text, so the reader is told why.
 */
export async function readInstructionFile(root: string, instructionPath: string, path: string) {
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\\:\0]/.test(p))) return undefined;
  let full = folderOf(root, instructionPath);
  for (const [index, part] of parts.entries()) {
    full = join(full, part);
    const info = await lstat(full).catch(() => undefined);
    if (!info || info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) return undefined;
  }
  const size = (await lstat(full)).size;
  if (size > INSTRUCTION_TEXT_LIMIT) return { text: null, size, binary: false, tooLarge: true };
  const bytes = await readFile(full);
  try {
    if (bytes.includes(0)) throw new TypeError('binary');
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), size, binary: false, tooLarge: false };
  } catch { return { text: null, size, binary: true, tooLarge: false }; }
}
