import { InitError, RepositoryReadError } from '@gitifact/core';
import { projectInitV4 } from '@gitifact/contracts';
import { initializeSpecProject } from './spec-init.js';
import type { AgentPreset } from './agent-block.js';
import { t } from '../shared/i18n/index.js';

export interface InitOptions { dryRun?: boolean; format?: 'json' | 'text'; agent?: AgentPreset; removeAgents?: boolean; skipAgents?: boolean }

export async function runInit(options: InitOptions, version: string) {
  try {
    const dto = await initializeSpecProject(process.cwd(), options.dryRun, process.env, undefined,
      { version, agent: options.agent, remove: options.removeAgents, skip: options.skipAgents });
    if (!dto.ok) throw new Error('unreachable');
    const docs = dto.agentDocs.mode === 'skip' ? t('init.text.skipped')
      : dto.agentDocs.paths.join(', ') + (dto.agentDocs.mode === 'remove' ? ' (' + t('init.text.blockRemoved') + ')' : dto.outcome === 'planned' ? ' (' + t('init.text.blockPlanned') + ')' : ' (' + t('init.text.blockUpdated') + ')');
    process.stdout.write(options.format === 'text'
      ? `${dto.outcome}: ${dto.rootPath}/.gitifact/config.json\n${t('init.text.storage')}: schemaVersion ${dto.schemaVersion}\n${t('init.text.agentDocs')}: ${docs}\n`
      : JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const failure = { code: known ? error.code : 'INIT_FAILED', message: known ? error.message : t('init.failed') };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n'
      : JSON.stringify(projectInitV4.parse({ contract: 'project-init', version: 4, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
