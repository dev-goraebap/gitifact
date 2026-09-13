import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { RepositoryReadError } from '@tryce/core';

export interface GitInvocation {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBytes: number;
  signal?: AbortSignal;
  acceptedExitCodes?: readonly number[];
  input?: Buffer;
}
export type GitRunner = (args: readonly string[], invocation: GitInvocation) => Promise<Buffer>;

export function classifyGitFailure(stderr: string, code: number | null): RepositoryReadError {
  if (code === 129 && /unknown (option|switch)|unsupported porcelain/i.test(stderr)) {
    return new RepositoryReadError('GIT_UNSUPPORTED');
  }
  if (/^fatal: not a git repository(?: \(|:)/m.test(stderr)) {
    return new RepositoryReadError('NOT_A_REPOSITORY');
  }
  return new RepositoryReadError('GIT_FAILED');
}
export function createGitRunner(executable = 'git'): GitRunner {
  return (args, { cwd, env, timeoutMs, maxBytes, signal, acceptedExitCodes = [0], input }) => new Promise((resolve, reject) => {
    if (timeoutMs <= 0) { reject(new RepositoryReadError('READ_LIMIT_EXCEEDED')); return; }
    const child = spawn(executable, [...args], { cwd, env, signal, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => { /* Process close/error reports failed Git invocations. */ });
    child.stdin.end(input);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let limited = false;
    let spawnFailed = false;
    const stop = () => {
      if (limited) return;
      limited = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      child.stdout.destroy();
      child.stderr.destroy();
      reject(new RepositoryReadError('READ_LIMIT_EXCEEDED'));
    };
    const timer = setTimeout(stop, timeoutMs);
    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop();
      else if (!limited) chunks.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.once('error', async (error: NodeJS.ErrnoException) => {
      spawnFailed = true;
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        const directoryExists = await stat(cwd).then((value) => value.isDirectory(), () => false);
        reject(new RepositoryReadError(directoryExists ? 'GIT_NOT_FOUND' : 'GIT_FAILED'));
      } else reject(new RepositoryReadError('GIT_FAILED'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (spawnFailed) return;
      if (limited) reject(new RepositoryReadError('READ_LIMIT_EXCEEDED'));
      else if (code === null || !acceptedExitCodes.includes(code)) reject(classifyGitFailure(Buffer.concat(stderr).toString('utf8'), code));
      else resolve(Buffer.concat(stdout));
    });
  });
}
