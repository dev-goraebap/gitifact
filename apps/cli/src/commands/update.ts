import { InitError, RepositoryReadError } from '@gitifact/core';
import { updateV1 } from '@gitifact/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { fetchLatestVersion, type FetchLatestVersion } from '../adapters/registry/latest-version.js';
import { disabledUpdate, npmGlobalInstall, resolveUpdate, updateCheckDisabled } from '../shared/update-check.js';
import { applyAgentDocs, planAgentDocs } from './agent-docs.js';
import type { AgentBlockControls } from './agent-block.js';
import { t } from '../shared/i18n/index.js';

export interface UpdateControls extends AgentBlockControls { fetchLatest?: FetchLatestVersion; timeoutMs?: number }
type AgentDocsState = { state: 'refreshed' | 'current' | 'not-initialized' | 'no-block'; paths: string[] };

// Rewrites only blocks that already exist. Outside an initialized project the command still reports versions.
async function refreshBlocks(cwd: string, version: string, env: NodeJS.ProcessEnv, controls: AgentBlockControls): Promise<AgentDocsState> {
  const repo = initRepository(cwd, env);
  let first: Awaited<ReturnType<typeof repo.inspect>>;
  let config: string | undefined;
  try { first = await repo.inspect(); config = await readConfigFile(first.state.repository.rootPath); }
  catch (error) {
    if ((error instanceof RepositoryReadError && error.code === 'NOT_A_REPOSITORY') || (error instanceof InitError && error.code === 'MIGRATION_REQUIRED')) return { state: 'not-initialized', paths: [] };
    throw error;
  }
  if (config === undefined) return { state: 'not-initialized', paths: [] };
  const root = first.state.repository.rootPath;
  const plan = await planAgentDocs(root, { version, onlyExisting: true, ...controls });
  if (plan.paths.length === 0) return { state: 'no-block', paths: [] };
  if (plan.writes.length === 0) return { state: 'current', paths: plan.paths };
  const unchanged = async () => {
    if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== config) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
  };
  return { state: 'refreshed', paths: await applyAgentDocs(root, plan, unchanged) };
}
export async function updateCommand(cwd: string, version: string, env: NodeJS.ProcessEnv = process.env, controls: UpdateControls = {}) {
  const [update, agentDocs] = await Promise.all([
    updateCheckDisabled(env) ? disabledUpdate : resolveUpdate(version, controls.fetchLatest ?? fetchLatestVersion, undefined, controls.timeoutMs),
    refreshBlocks(cwd, version, env, controls),
  ]);
  return updateV1.parse({ contract: 'update', version: 1, ok: true, cliVersion: version, update,
    install: update.status === 'available' ? { npmGlobal: npmGlobalInstall(update.latestVersion!) } : null, agentDocs });
}
export async function runUpdate(options: { format?: 'json' | 'text' }, version: string) {
  try {
    const dto = await updateCommand(process.cwd(), version);
    if (!dto.ok) throw new Error('unreachable');
    if (options.format !== 'text') { process.stdout.write(JSON.stringify(dto) + '\n'); return; }
    const lines = [t('update.text.current', { version: dto.cliVersion })];
    lines.push(dto.update.status === 'available' ? t('update.text.available', { version: dto.update.latestVersion })
      : dto.update.status === 'up-to-date' ? t('update.text.upToDate')
      : dto.update.status === 'disabled' ? t('update.text.disabled') : t('update.text.unavailable'));
    if (dto.install) lines.push(t('update.text.install', { command: dto.install.npmGlobal }), t('update.text.afterInstall'));
    lines.push(dto.agentDocs.state === 'refreshed' ? t('update.text.blockRefreshed', { paths: dto.agentDocs.paths.join(', ') })
      : dto.agentDocs.state === 'current' ? t('update.text.blockCurrent', { paths: dto.agentDocs.paths.join(', ') })
      : dto.agentDocs.state === 'no-block' ? t('update.text.noBlock') : t('update.text.notInitialized'));
    process.stdout.write(lines.join('\n') + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const failure = { code: known ? error.code : 'UPDATE_FAILED', message: known ? error.message : t('update.failed') };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n'
      : JSON.stringify(updateV1.parse({ contract: 'update', version: 1, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
