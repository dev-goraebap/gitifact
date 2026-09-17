import type { UpdateStateV1 } from '@gitifact/contracts';
import type { FetchLatestVersion } from '../adapters/registry/latest-version.js';

// Shared by the browser server and `gitifact update` so both report the same state for the same answer.
export const updateCheckTimeoutMs = 3000;
const release = /^(\d+)\.(\d+)\.(\d+)$/;
const running = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

// True when `latest` (a plain release) is newer than the running CLI. A pre-release build counts as older
// than the release with the same numbers. Anything unparsable is not newer.
export function isNewerRelease(latest: string, current: string) {
  const next = release.exec(latest); const now = running.exec(current);
  if (!next || !now) return false;
  for (let index = 1; index <= 3; index++) {
    const difference = Number(next[index]) - Number(now[index]);
    if (difference !== 0) return difference > 0;
  }
  return now[4] !== undefined;
}
export const updateCheckDisabled = (env: NodeJS.ProcessEnv, flagged = false) =>
  flagged || (env.GITIFACT_NO_UPDATE_CHECK !== undefined && env.GITIFACT_NO_UPDATE_CHECK !== '' && env.GITIFACT_NO_UPDATE_CHECK !== '0');

export const checkingUpdate: UpdateStateV1 = { status: 'checking', latestVersion: null };
export const disabledUpdate: UpdateStateV1 = { status: 'disabled', latestVersion: null };
// Never rejects: offline, timeout, abort and malformed answers all become `unavailable`.
// The deadline is an ordinary timer, not AbortSignal.timeout: that one is unreferenced, so a fetcher that never
// settles would leave nothing to wake the process and the result would never arrive.
export async function resolveUpdate(current: string, fetchLatest: FetchLatestVersion, signal?: AbortSignal, timeoutMs = updateCheckTimeoutMs): Promise<UpdateStateV1> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const latest = await Promise.race([
      fetchLatest(controller.signal),
      new Promise<never>((_resolve, reject) => {
        if (controller.signal.aborted) reject(new Error('aborted'));
        else controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    ]);
    if (typeof latest !== 'string' || !release.test(latest)) return { status: 'unavailable', latestVersion: null };
    return { status: isNewerRelease(latest, current) ? 'available' : 'up-to-date', latestVersion: latest };
  } catch { return { status: 'unavailable', latestVersion: null }; }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export const npmGlobalInstall = (version: string) => 'npm install -g gitifact@' + version;
