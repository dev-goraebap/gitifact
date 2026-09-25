import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGitRunner } from '../../adapters/git/run-git.js';

/**
 * A fingerprint of what the browser shows: HEAD, Git's status of the store folder and AGENTS.md, and the modification
 * time and size of each file the status names, so a file edited again while already modified still changes it. One
 * `rev-parse` and one `status` (about 50 ms); the checkout carries the stamp it was read at, and the browser asks for a
 * new one when the reader comes back to the tab.
 */
export function createStampReader(root: string, inherited = process.env) {
  const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) =>
    (await runner(['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 16 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  return async (): Promise<string> => {
    const [head, status] = await Promise.all([
      git(['rev-parse', '--verify', '--quiet', 'HEAD'], [0, 1]),
      git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', ':(top).gitifact', ':(top)AGENTS.md']),
    ]);
    const paths = status.split('\0').filter(Boolean).map(entry => entry.slice(3)).filter(path => !path.startsWith('.gitifact/cache/'));
    const seen = await Promise.all(paths.map(async path => {
      const info = await lstat(join(root, ...path.split('/'))).catch(() => undefined);
      return path + '\t' + (info ? info.mtimeMs + ':' + info.size : '-');
    }));
    return createHash('sha256').update(head.trim() + '\n' + seen.sort().join('\n')).digest('hex').slice(0, 20);
  };
}
