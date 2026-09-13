import { InitError, RepositoryReadError } from '@tryce/core';
import { escapeTerminal } from '../output/repository-status.js';
import { workflowV1 } from '@tryce/contracts';
export async function runWorkflow(command: string, action: () => Promise<unknown>, format?: string) {
  try {
    const data = await action();
    const dto = workflowV1.parse({ contract: 'workflow', version: 1, ok: true, command, data });
    process.stdout.write(format === 'text' ? JSON.stringify(dto, null, 2) + '\n' : JSON.stringify(dto) + '\n');
  } catch (e) {
    const known = e instanceof InitError || e instanceof RepositoryReadError;
    const error = { code: known ? e.code : 'WORKFLOW_FAILED', message: known ? e.message : '작업이 중단됐습니다. 기록·Git 상태·남은 잠금을 확인하세요.' };
    process.stderr.write(format === 'text' ? error.code + ': ' + escapeTerminal(error.message) + '\n' : JSON.stringify({ contract: 'workflow', version: 1, ok: false, command, error }) + '\n');
    process.exitCode = 1;
  }
}
