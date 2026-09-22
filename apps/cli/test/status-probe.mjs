// Reads the repository status the browser serves (/api/v1/status) in its own process, so the status tests keep
// exercising the reader with a controlled environment after the `status` command was removed.
import { randomUUID } from 'node:crypto';
import { readRepositoryStatus } from '@gitifact/core';
import { createRepositoryReader } from '../.test-build/adapters/git/repository-reader.js';
import { failureDto, statusDto } from '../.test-build/output/repository-status.js';

try {
  const observation = await readRepositoryStatus(createRepositoryReader(process.cwd()), { now: () => new Date().toISOString(), newId: randomUUID });
  process.stdout.write(JSON.stringify(statusDto(observation)) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify(failureDto(error)) + '\n');
  process.exitCode = 1;
}
