import { InitError, RepositoryReadError } from '@gitifact/core';
import { projectInitV6 } from '@gitifact/contracts';
import { initializeSpecProject } from './spec-init.js';
import type { AgentPreset } from './agent-block.js';
import { fetchLatestVersion } from '../adapters/registry/latest-version.js';
import { disabledUpdate, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { t } from '../shared/i18n/index.js';

export interface InitOptions { dryRun?: boolean; format?: 'json' | 'text'; agent?: AgentPreset; removeAgents?: boolean; skipAgents?: boolean }

export async function runInit(options: InitOptions, version: string) {
  // An agent told to install gitifact only when it is missing keeps an older install; the result says a newer release
  // exists. The check runs beside init, never blocks it for more than its timeout, and is cancelled when init fails.
  const cancel = new AbortController();
  const update = updateCheckDisabled(process.env) ? disabledUpdate : resolveUpdate(version, fetchLatestVersion, cancel.signal);
  try {
    const dto = await initializeSpecProject(process.cwd(), options.dryRun, process.env, undefined,
      { version, agent: options.agent, remove: options.removeAgents, skip: options.skipAgents }, undefined, update);
    if (!dto.ok) throw new Error('unreachable');
    const docs = dto.agentDocs.mode === 'skip' ? t('init.text.skipped')
      : dto.agentDocs.paths.join(', ') + (dto.agentDocs.mode === 'remove' ? ' (' + t('init.text.blockRemoved') + ')' : dto.outcome === 'planned' ? ' (' + t('init.text.blockPlanned') + ')' : ' (' + t('init.text.blockUpdated') + ')');
    const newer = dto.install ? t('init.text.updateAvailable', { version: dto.update.latestVersion, command: dto.install.npx }) + '\n' : '';
    process.stdout.write(options.format === 'text'
      ? `${dto.outcome}: ${dto.rootPath}/.gitifact/config.json\n${t('init.text.storage')}: schemaVersion ${dto.schemaVersion}\n${t('init.text.agentDocs')}: ${docs}\n${newer}`
      : JSON.stringify(dto) + '\n');
  } catch (error) {
    cancel.abort();
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const failure = { code: known ? error.code : 'INIT_FAILED', message: known ? error.message : t('init.failed') };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n'
      : JSON.stringify(projectInitV6.parse({ contract: 'project-init', version: 6, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
