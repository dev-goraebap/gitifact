import { InitError, RepositoryReadError } from '@gitifact/core';
import { initializeSpecProject } from './spec-init.js';

export interface InitOptions { dryRun?: boolean; format?: 'json' | 'text' }

export async function runInit(options: InitOptions) {
  try {
    const dto = await initializeSpecProject(process.cwd(), options.dryRun);
    process.stdout.write(options.format === 'text' ? `${dto.outcome}: ${dto.rootPath}/.gitifact/config.json\n저장 규약: schemaVersion 1\n스킬·훅은 설치하지 않았습니다.\n` : JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    // The failure envelope keeps its existing project-init version 1 shape.
    const failure = { code: known ? error.code : 'INIT_FAILED', message: known ? error.message : '초기화에 실패했습니다. 파일 접근 권한과 생성된 설정·임시 파일을 확인하세요.' };
    process.stderr.write(options.format === 'text' ? failure.code + ': ' + failure.message + '\n' : JSON.stringify({ contract: 'project-init', version: 1, ok: false, error: failure }) + '\n');
    process.exitCode = 1;
  }
}
