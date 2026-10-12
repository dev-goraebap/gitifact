import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The launcher init and update keep in a project: agents run `node .gitifact/bin/cli.mjs <command>`, and it runs the
 * release in the config's `cli` from the user's cache. The file is Gitifact's own and is rewritten whenever it differs.
 */
export const LAUNCHER_PATH = '.gitifact/bin/cli.mjs';

/**
 * The launcher this CLI ships, beside the bundled entry point as dist/launcher/cli.mjs; undefined when this code runs
 * from somewhere without it (the compiled test build), where init and update then leave the launcher alone.
 */
export const readBundledLauncher = () => readFile(new URL('./launcher/cli.mjs', import.meta.url), 'utf8')
  .catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });

/** Writes the bundled launcher into the project when this CLI has one; answers whether it wrote. */
export async function refreshLauncher(root: string): Promise<boolean> {
  const text = await readBundledLauncher();
  return text === undefined ? false : writeLauncher(root, text.replace(/\r\n/g, '\n'));
}

/** Writes the launcher when it is missing or differs; answers whether it wrote. A link in its place is refused. */
export async function writeLauncher(root: string, text: string): Promise<boolean> {
  const folder = join(root, '.gitifact', 'bin'); const file = join(folder, 'cli.mjs');
  const folderInfo = await lstat(folder).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
  if (folderInfo && (!folderInfo.isDirectory() || folderInfo.isSymbolicLink())) throw Object.assign(new Error(folder), { code: 'ENOTDIR' });
  if (!folderInfo) await mkdir(folder);
  const info = await lstat(file).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
  if (info && (!info.isFile() || info.isSymbolicLink())) throw Object.assign(new Error(file), { code: 'ENOTDIR' });
  if (info && (await readFile(file, 'utf8')).replace(/\r\n/g, '\n') === text) return false;
  await writeFile(file, text);
  return true;
}
