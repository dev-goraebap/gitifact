import { updateCheckV1 } from '@gitifact/contracts';
import { fetchLatestVersion } from '../adapters/registry/latest-version.js';
import { recordUpdateCheck } from '../adapters/filesystem/user-cache.js';
import { type FetchLatestVersion, disabledUpdate, npmGlobalInstall, npxUpdate, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { t } from '../shared/i18n/index.js';

export async function checkUpdateCommand(version: string, env: NodeJS.ProcessEnv = process.env,
  controls: { fetchLatest?: FetchLatestVersion; timeoutMs?: number; now?: () => number } = {}) {
  const update = updateCheckDisabled(env) ? disabledUpdate
    : await resolveUpdate(version, controls.fetchLatest ?? fetchLatestVersion, undefined, controls.timeoutMs);
  // The notice every command shows reuses this answer instead of asking the registry again.
  await recordUpdateCheck(env, update, controls.now?.());
  return updateCheckV1.parse({ contract: 'update-check', version: 1, ok: true, cliVersion: version, update,
    command: update.status === 'available' ? npxUpdate(update.latestVersion!) : null });
}

export async function runUpdateCheck(format: 'json' | 'text', version: string) {
  const dto = await checkUpdateCommand(version);
  if (format === 'json') { process.stdout.write(JSON.stringify(dto) + '\n'); return; }
  const state = dto.update;
  const lines = [t('update.text.current', { version: dto.cliVersion }),
    state.status === 'available' ? t('update.text.available', { version: state.latestVersion })
      : state.status === 'up-to-date' ? t('update.text.upToDate')
      : state.status === 'disabled' ? t('update.text.disabled') : t('update.text.unavailable')];
  // The JSON keeps its v1 npx command; people are shown the global install, the one way this release recommends.
  if (state.status === 'available') lines.push(t('update.text.install', { command: npmGlobalInstall(state.latestVersion!) }), t('update.text.afterInstall'));
  process.stdout.write(lines.join('\n') + '\n');
}
