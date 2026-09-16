import { InitError, RepositoryReadError } from '@gitifact/core';
import { projectInitV4 } from '@gitifact/contracts';
import { initializeSpecProject } from './spec-init.js';
import type { AgentPreset } from './agent-block.js';

export interface InitOptions { dryRun?: boolean; format?: 'json' | 'text'; agent?: AgentPreset; removeAgents?: boolean; skipAgents?: boolean }

export async function runInit(options: InitOptions, version: string) {
  try {
    const dto = await initializeSpecProject(process.cwd(), options.dryRun, process.env, undefined,
      { version, agent: options.agent, remove: options.removeAgents, skip: options.skipAgents });
    if (!dto.ok) throw new Error('unreachable');
    const docs = dto.agentDocs.mode === 'skip' ? '건너뜀'
      : dto.agentDocs.paths.join(', ') + (dto.agentDocs.mode === 'remove' ? ' (블록 제거)' : dto.outcome === 'planned' ? ' (블록 설치 예정)' : ' (블록 갱신)');
    process.stdout.write(options.format === 'text'
      ? `${dto.outcome}: ${dto.rootPath}/.gitifact/config.json\n저장 규약: schemaVersion 1\n에이전트 지침: ${docs}\n`
      : JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const failure = { code: known ? error.code : 'INIT_FAILED', message: known ? error.message : '초기화에 실패했습니다. 파일 접근 권한과 생성된 설정·임시 파일을 확인하세요.' };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n'
      : JSON.stringify(projectInitV4.parse({ contract: 'project-init', version: 4, ok: false, error: failure })) + '\n');
    process.exitCode = 1;
  }
}
