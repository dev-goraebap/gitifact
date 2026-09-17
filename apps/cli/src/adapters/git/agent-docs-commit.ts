import { createGitRunner } from './run-git.js';

// Git access for `gitifact update --commit`. The command decides what may be committed; this only reads HEAD and commits.
export function agentDocsGit(root: string, inherited: NodeJS.ProcessEnv = process.env) {
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C' };
  const runner = createGitRunner();
  const git = (args: string[], acceptedExitCodes = [0]) => runner(['-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env, timeoutMs: 120000, maxBytes: 16 * 1024 * 1024, acceptedExitCodes });
  return {
    async head() { return (await git(['rev-parse', '-q', '--verify', 'HEAD^{commit}'], [0, 1])).toString('utf8').trim() || null; },
    // The committed text of a path, or null when HEAD does not track it.
    async committed(head: string, path: string) {
      if ((await git(['ls-tree', '-z', head, '--', path])).length === 0) return null;
      return (await git(['cat-file', 'blob', head + ':' + path])).toString('utf8');
    },
    // `--only` commits the working content of these paths and leaves every other staged entry staged. Hooks and signing stay on.
    async commitOnly(paths: string[], message: string) { await git(['commit', '--only', '-m', message, '--', ...paths]); },
    async changedPaths(commit: string) {
      return (await git(['diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', '--root', commit])).toString('utf8').split('\0').filter(Boolean).sort();
    },
    async parents(commit: string) { return (await git(['rev-list', '--parents', '-n', '1', commit])).toString('utf8').trim().split(' ').slice(1); },
  };
}
