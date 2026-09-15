import { randomUUID } from 'node:crypto';
import { readRepositoryStatus } from '@gitifact/core';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { failureDto, statusDto, statusText } from '../output/repository-status.js';

export async function runStatus(format: 'json' | 'text'): Promise<void> {
  try {
    const observation = await readRepositoryStatus(createRepositoryReader(process.cwd()), {
      now: () => new Date().toISOString(), newId: randomUUID,
    });
    const dto = statusDto(observation);
    process.stdout.write(format === 'json' ? JSON.stringify(dto) + '\n' : statusText(dto));
  } catch (error) {
    const dto = failureDto(error);
    process.stderr.write(format === 'json' ? JSON.stringify(dto) + '\n' : dto.error.code + ': ' + dto.error.message + '\n');
    process.exitCode = 1;
  }
}
