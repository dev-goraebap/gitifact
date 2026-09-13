import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { RepositoryReadError } from '@tryce/core';
import type { ObjectFormat, RepositoryReader, RepositoryState } from '@tryce/core';
import { decodeGitLine, parsePorcelain } from './porcelain.js';
import { createGitRunner } from './run-git.js';
import type { GitRunner } from './run-git.js';

interface Options {
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  run?: GitRunner;
  monotonicNow?: () => number;
  attemptTimeoutMs?: number;
  maxBytes?: number;
}
interface Location {
  rootPath: string;
  gitDir: string;
  commonDir: string;
  objectFormat: ObjectFormat;
}
const overrides = new Set(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']);
const baseArgs = ['--no-optional-locks', '-c', 'core.fsmonitor=false'];
const statusArgs = ['status', '--porcelain=v2', '--branch', '--untracked-files=all', '--ignore-submodules=none', '--no-renames', '-z'];
const identity = (prefix: string, path: string) =>
  prefix + ':' + createHash('sha256').update(prefix + '\0' + path).digest('hex');

export function createRepositoryReader(cwd: string, options: Options = {}): RepositoryReader {
  return {
    async read(): Promise<RepositoryState> {
      const inherited = options.env ?? process.env;
      if (Object.keys(inherited).some((key) => overrides.has(key.toUpperCase()) && inherited[key] !== undefined)) {
        throw new RepositoryReadError('GIT_CONTEXT_OVERRIDE');
      }
      const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', LC_ALL: 'C', LANG: 'C' };
      const run = options.run ?? createGitRunner();
      const now = options.monotonicNow ?? (() => performance.now());
      for (let attempt = 0; attempt < 2; attempt++) {
        const deadline = now() + (options.attemptTimeoutMs ?? 15_000);
        const invoke = async (args: string[], directory = cwd) => {
          options.signal?.throwIfAborted();
          const timeoutMs = deadline - now();
          if (timeoutMs <= 0) throw new RepositoryReadError('READ_LIMIT_EXCEEDED');
          const output = await run([...baseArgs, ...args], {
            cwd: directory, env, timeoutMs, maxBytes: options.maxBytes ?? 16 * 1024 * 1024,
            ...(options.signal ? { signal: options.signal } : {}),
          });
          if (now() > deadline) throw new RepositoryReadError('READ_LIMIT_EXCEEDED');
          return output;
        };
        const discover = async (): Promise<Location> => {
          const scalar = async (flag: string) => decodeGitLine(await invoke(['rev-parse', '--path-format=absolute', flag]));
          const flags = ['--is-bare-repository', '--is-inside-git-dir', '--is-inside-work-tree'];
          const paths = ['--show-toplevel', '--absolute-git-dir', '--git-common-dir', '--show-object-format'];
          let combined: string[];
          try { combined = decodeGitLine(await invoke(['rev-parse', '--path-format=absolute', ...flags, ...paths])).split('\n'); }
          catch (error) {
            // --show-toplevel fails for bare repositories. Preserve their explicit diagnosis.
            const context = decodeGitLine(await invoke(['rev-parse', ...flags])).split('\n');
            if (context[0] === 'true' || context[1] === 'true' || context[2] === 'false') throw new RepositoryReadError('UNSUPPORTED_REPOSITORY');
            throw error;
          }
          const [bare, internal, inside] = combined;
          if (![bare, internal, inside].every((v) => v === 'true' || v === 'false')) {
            throw new RepositoryReadError('GIT_UNSUPPORTED');
          }
          if (bare === 'true' || internal === 'true' || inside !== 'true') throw new RepositoryReadError('UNSUPPORTED_REPOSITORY');
          let values = combined.slice(3);
          // A legal POSIX path can contain newlines. Fall back to individual reads
          // instead of guessing field boundaries in that uncommon case.
          if (values.length !== paths.length) values = await Promise.all(paths.map(scalar));
          const [rootPath, gitDir, commonDir, objectFormat] = values as [string, string, string, string];
          if (objectFormat !== 'sha1' && objectFormat !== 'sha256') throw new RepositoryReadError('GIT_UNSUPPORTED');
          return { rootPath, gitDir, commonDir, objectFormat };
        };
        const before = await discover();
        const first = parsePorcelain(await invoke(statusArgs, before.rootPath), before.objectFormat);
        const second = parsePorcelain(await invoke(statusArgs, before.rootPath), before.objectFormat);
        const after = await discover();
        if (JSON.stringify(before) === JSON.stringify(after) && first.comparison === second.comparison) {
          return {
            repository: {
              rootPath: before.rootPath,
              key: identity('repo', before.commonDir),
              worktreeKey: identity('worktree', before.gitDir),
              objectFormat: before.objectFormat,
            },
            head: second.head,
            changes: second.changes,
          };
        }
      }
      throw new RepositoryReadError('REPOSITORY_CHANGED');
    },
  };
}
