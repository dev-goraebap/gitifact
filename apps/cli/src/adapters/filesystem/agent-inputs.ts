import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readdir, realpath, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

/** Tests replace the system temporary folder and the clock so real user folders stay untouched. */
export interface AgentInputControls { tmpdir?: () => string; now?: () => number }

const maxAge = 7 * 24 * 60 * 60 * 1000;
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const comparable = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path;

/** One folder per repository under the system temporary folder, then the ignored project fallback. */
async function candidates(root: string, controls: AgentInputControls) {
  const key = createHash('sha256').update(comparable(await realpath(root))).digest('hex').slice(0, 16);
  return { system: join((controls.tmpdir ?? tmpdir)(), 'gitifact', key), project: join(root, '.gitifact', 'tmp') };
}

async function writable(directory: string) {
  try {
    await mkdir(directory, { recursive: true });
    const stat = await info(directory);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) return false;
    const probe = join(directory, '.probe-' + randomBytes(8).toString('hex'));
    await writeFile(probe, '', { flag: 'wx' }); await unlink(probe);
    return true;
  } catch { return false; }
}

/**
 * Returns where agents write the commit input file, preferring a folder outside the repository.
 * Sandboxes that block writes outside the working tree get `.gitifact/tmp/`, which ignores itself.
 * Files older than seven days in the chosen folder are removed on each call; failures never block the read.
 */
export async function prepareAgentInputs(root: string, controls: AgentInputControls = {}) {
  const { system, project } = await candidates(root, controls);
  let directory: string | undefined;
  if (await writable(system)) directory = system;
  else if (await writable(project)) {
    directory = project;
    // A folder that ignores itself keeps `git status` clean without a tracked .gitignore elsewhere.
    await writeFile(join(project, '.gitignore'), '*\n', { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  }
  if (!directory) return undefined;
  const now = (controls.now ?? Date.now)();
  for (const name of await readdir(directory).catch(() => [] as string[])) {
    if (name === '.gitignore') continue;
    const stat = await info(join(directory, name)).catch(() => undefined);
    if (stat?.isFile() && now - stat.mtimeMs > maxAge) await unlink(join(directory, name)).catch(() => undefined);
  }
  return { commit: join(directory, 'commit.json') };
}

/** Deletes a consumed input file only when it sits directly in one of this repository's managed folders. */
export async function discardAgentInput(root: string, file: string, controls: AgentInputControls = {}) {
  try {
    const stat = await info(file);
    if (!stat?.isFile() || stat.isSymbolicLink()) return false;
    const parent = comparable(await realpath(dirname(file)));
    const { system, project } = await candidates(root, controls);
    let managed = false;
    for (const directory of [system, project]) {
      if (await info(directory) && comparable(await realpath(directory)) === parent) managed = true;
    }
    if (!managed || basename(file) === '.gitignore') return false;
    await unlink(file); return true;
  } catch { return false; }
}
