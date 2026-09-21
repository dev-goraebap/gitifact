import { updateCheckV1 } from '@gitifact/contracts';
import { fetchLatestVersion, type FetchLatestVersion } from '../adapters/registry/latest-version.js';
import { disabledUpdate, npxUpdate, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { t } from '../shared/i18n/index.js';

export async function checkUpdateCommand(version: string, env: NodeJS.ProcessEnv = process.env,
  controls: { fetchLatest?: FetchLatestVersion; timeoutMs?: number } = {}) {
  const update = updateCheckDisabled(env) ? disabledUpdate
    : await resolveUpdate(version, controls.fetchLatest ?? fetchLatestVersion, undefined, controls.timeoutMs);
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
  if (dto.command) lines.push(t('update.text.install', { command: dto.command }));
  process.stdout.write(lines.join('\n') + '\n');
}
