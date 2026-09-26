import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { UpdateStateV1 } from '@gitifact/contracts';

// What every command knows about new releases without asking the registry: the last answer, when it came, a check in
// progress, and a release the user chose to hear about later. The file is the user's, not the project's, and a missing
// or broken one reads as empty.
export interface UpdateCache { checkedAt?: string; latest?: string; checkingSince?: string; later?: { version: string; until: string } }

/** The per-user cache folder: GITIFACT_CACHE_DIR, else the operating system's cache location. */
export function userCacheDirectory(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, home = homedir()) {
  if (env.GITIFACT_CACHE_DIR) return env.GITIFACT_CACHE_DIR;
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'gitifact');
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'gitifact');
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), 'gitifact');
}
const cacheFile = (env: NodeJS.ProcessEnv) => join(userCacheDirectory(env), 'update.json');

const isTime = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
export async function readUpdateCache(env: NodeJS.ProcessEnv = process.env): Promise<UpdateCache> {
  let value: Record<string, unknown>;
  try { value = JSON.parse(await readFile(cacheFile(env), 'utf8')) as Record<string, unknown>; } catch { return {}; }
  if (typeof value !== 'object' || value === null) return {};
  const later = value.later as Record<string, unknown> | undefined;
  return {
    ...(isTime(value.checkedAt) ? { checkedAt: value.checkedAt } : {}),
    ...(typeof value.latest === 'string' ? { latest: value.latest } : {}),
    ...(isTime(value.checkingSince) ? { checkingSince: value.checkingSince } : {}),
    ...(later && typeof later.version === 'string' && isTime(later.until) ? { later: { version: later.version, until: later.until } } : {}),
  };
}

// Read, change, and replace the whole file through a temporary one, so a reader never sees half a file. Two writers can
// still race and one change be lost; the next check repairs it. Failures are swallowed: the cache only saves requests.
export async function changeUpdateCache(env: NodeJS.ProcessEnv, change: (cache: UpdateCache) => UpdateCache) {
  const directory = userCacheDirectory(env);
  const temporary = join(directory, 'update-' + randomUUID() + '.tmp');
  try {
    const next = change(await readUpdateCache(env));
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, JSON.stringify(next) + '\n', 'utf8');
    await rename(temporary, cacheFile(env));
  } catch { await unlink(temporary).catch(() => {}); }
}

/** Keeps a finished registry check. An unavailable answer keeps the last known release and still counts as checked. */
export async function recordUpdateCheck(env: NodeJS.ProcessEnv, update: UpdateStateV1, now = Date.now()) {
  if (update.status === 'disabled' || update.status === 'checking') return;
  await changeUpdateCache(env, ({ checkingSince: _done, ...cache }) =>
    ({ ...cache, checkedAt: new Date(now).toISOString(), ...(update.latestVersion ? { latest: update.latestVersion } : {}) }));
}
