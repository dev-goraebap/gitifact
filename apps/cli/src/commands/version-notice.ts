import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { updateLaterV1 } from '@gitifact/contracts';
import { fetchLatestVersion } from '../adapters/registry/latest-version.js';
import { changeUpdateCache, readUpdateCache, recordUpdateCheck, type UpdateCache } from '../adapters/filesystem/user-cache.js';
import { type FetchLatestVersion, isNewerRelease, npmGlobalInstall, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { findProjectConfig } from '../shared/project-config.js';
import { projectSettings } from './project-settings.js';
import { t } from '../shared/i18n/index.js';

// Every command starts with one line about versions when there is something to say. It reads only local files: the
// project's config and the user's cache. The registry is asked by a separate process once the cache is an hour old, so
// no command waits on the network; what it learns shows from the next command on.
export const REFRESH_AFTER_MS = 60 * 60 * 1000;
// A check started this recently is still running (or died); another command does not start a second one.
export const CHECKING_WINDOW_MS = 5 * 60 * 1000;
export const LATER_MS = 24 * 60 * 60 * 1000;
export const REFRESH_COMMAND = '__refresh-update';

export type VersionNotice = { kind: 'project-newer'; project: string } | { kind: 'release'; latest: string } | { kind: 'project-older'; project: string };
// init and update report the release they checked themselves, and both bring the project up to this CLI.
export interface NoticeScope { release: boolean; projectOlder: boolean }
export const noticeScope = (command: string): NoticeScope =>
  ({ release: command !== 'init' && command !== 'update', projectOlder: command !== 'init' && command !== 'update' });

/** One notice at most: a project ahead of this CLI first, then a newer release, then a project behind it. */
export function chooseNotice(running: string, project: string | undefined, cache: UpdateCache, now: number, scope: NoticeScope = { release: true, projectOlder: true }): VersionNotice | null {
  if (project && isNewerRelease(project, running)) return { kind: 'project-newer', project };
  const latest = cache.latest;
  const postponed = cache.later !== undefined && cache.later.version === latest && now < Date.parse(cache.later.until);
  if (scope.release && latest && isNewerRelease(latest, running) && !postponed) return { kind: 'release', latest };
  if (scope.projectOlder && project && isNewerRelease(running, project)) return { kind: 'project-older', project };
  return null;
}
export function noticeText(notice: VersionNotice, running: string) {
  if (notice.kind === 'project-newer') return t('notice.projectNewer', { project: notice.project, version: running, command: npmGlobalInstall(notice.project) });
  if (notice.kind === 'release') return t('notice.release', { latest: notice.latest, version: running, command: npmGlobalInstall(notice.latest) });
  return t('notice.projectOlder', { project: notice.project, version: running });
}

export const needsRefresh = (cache: UpdateCache, now: number) =>
  !(cache.checkedAt && now - Date.parse(cache.checkedAt) < REFRESH_AFTER_MS) && !(cache.checkingSince && now - Date.parse(cache.checkingSince) < CHECKING_WINDOW_MS);

// The check runs as this same CLI in a detached process that outlives the command, with no console window on Windows.
// It starts in the home folder: on Windows a running process's folder cannot be removed, and the project's must stay free.
const spawnRefresh = () => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, REFRESH_COMMAND], { cwd: homedir(), detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
};

export interface NoticeControls { cwd?: string; env?: NodeJS.ProcessEnv; now?: number; refresh?: () => void; write?: (line: string) => void }
/** The notice before a command. GITIFACT_NO_UPDATE_CHECK stops the release check; the project comparison stays, being local. */
export async function noticeVersion(version: string, command: string, controls: NoticeControls = {}) {
  const env = controls.env ?? process.env; const now = controls.now ?? Date.now();
  try {
    const project = projectSettings((await findProjectConfig(controls.cwd ?? process.cwd()))?.text).cli;
    const scope = noticeScope(command);
    let cache: UpdateCache = {};
    if (!updateCheckDisabled(env)) {
      cache = await readUpdateCache(env);
      // init and update ask the registry themselves and keep the answer; no second check starts beside them.
      if (scope.release && needsRefresh(cache, now)) {
        await changeUpdateCache(env, current => ({ ...current, checkingSince: new Date(now).toISOString() }));
        (controls.refresh ?? spawnRefresh)();
      }
    }
    const notice = chooseNotice(version, project, cache, now, scope);
    if (notice) (controls.write ?? (line => process.stderr.write(line + '\n')))(noticeText(notice, version));
  } catch { /* A notice never stops the command it precedes. */ }
}

/** The hidden command the detached process runs: ask the registry once and keep the answer. */
export async function refreshUpdateCache(version: string, env: NodeJS.ProcessEnv = process.env, fetchLatest: FetchLatestVersion = fetchLatestVersion, now?: () => number) {
  if (updateCheckDisabled(env)) return;
  const update = await resolveUpdate(version, fetchLatest);
  await recordUpdateCheck(env, update, now?.());
}

/** `update --later`: the known newer release stays quiet for a day. A release newer than it is announced again. */
export async function postponeRelease(version: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  const cache = await readUpdateCache(env);
  const later = cache.latest && isNewerRelease(cache.latest, version) ? { version: cache.latest, until: new Date(now + LATER_MS).toISOString() } : null;
  if (later) await changeUpdateCache(env, current => ({ ...current, later }));
  return updateLaterV1.parse({ contract: 'update-later', version: 1, ok: true, cliVersion: version, later });
}
export async function runUpdateLater(format: 'json' | 'text', version: string) {
  const dto = await postponeRelease(version);
  process.stdout.write(format === 'json' ? JSON.stringify(dto) + '\n'
    : (dto.later ? t('update.later.postponed', { latest: dto.later.version, until: new Date(dto.later.until).toLocaleString() }) : t('update.later.nothing', { version })) + '\n');
}
