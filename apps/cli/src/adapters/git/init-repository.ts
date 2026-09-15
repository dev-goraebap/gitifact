import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InitError } from '@gitifact/core';
import type { ProjectConfig, RepositoryState } from '@gitifact/core';
import { createRepositoryReader } from './repository-reader.js';
import { createGitRunner } from './run-git.js';
import { decodeGitLine } from './porcelain.js';
import { fileInfo } from '../filesystem/config-file.js';

export function initRepository(cwd: string, inherited: NodeJS.ProcessEnv = process.env) {
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C' };
  const runner = createGitRunner();
  const git = (args: string[], root: string, acceptedExitCodes = [0], input?: Buffer) => runner(['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, env: args[0] === 'check-ignore' ? { ...env, GIT_LITERAL_PATHSPECS: '0' } : env,
    timeoutMs: 15000, maxBytes: 16 * 1024 * 1024, acceptedExitCodes, ...(input ? { input } : {}),
  });
  return {
    async inspect(observedState?: RepositoryState, includeTrackedConfig = true) {
      const state = observedState ?? await createRepositoryReader(cwd, { env }).read();
      const root = state.repository.rootPath;
      const locations = decodeGitLine(await git(['rev-parse', '--path-format=absolute', '--absolute-git-dir', '--git-path', 'index'], root)).split('\n');
      const gitDir = locations.length === 2 ? locations[0]! : decodeGitLine(await git(['rev-parse', '--absolute-git-dir'], root));
      const indexPath = locations.length === 2 ? locations[1]! : decodeGitLine(await git(['rev-parse', '--path-format=absolute', '--git-path', 'index'], root));
      for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock']) {
        if (await fileInfo(join(gitDir, marker))) throw new InitError('GIT_OPERATION_IN_PROGRESS', 'Git 작업이 진행 중입니다: ' + marker);
      }
      if (state.changes.some(change => change.kind === 'unmerged')) throw new InitError('GIT_OPERATION_IN_PROGRESS', 'Git 충돌을 먼저 해결하세요.');
      const index = await readFile(indexPath).catch(error => { if (error.code === 'ENOENT') return Buffer.alloc(0); throw error; });
      const [staged, committed] = includeTrackedConfig ? await Promise.all([
        git(['ls-files', '--stage', '-z', '--', '.gitifact/config.json'], root),
        state.head.commit ? git(['ls-tree', '-z', state.head.commit, '--', '.gitifact/config.json'], root) : Buffer.alloc(0),
      ]) : [Buffer.alloc(0), Buffer.alloc(0)];
      return { state, trackedConfig: staged.length > 0 || committed.length > 0,
        stamp: JSON.stringify({ repository: state.repository, head: state.head, index: createHash('sha256').update(index).digest('hex') }) };
    },
    async trackedPaths(root: string, prefix: string, commit: string | null) {
      const indexed = await git(['ls-files', '-z', '--', prefix], root);
      const committed = commit ? await git(['ls-tree', '-r', '--name-only', '-z', commit, '--', prefix], root) : Buffer.alloc(0);
      return [...new Set(Buffer.concat([indexed, committed]).toString('utf8').split('\0').filter(Boolean))];
    },
    async checkIgnore(root: string, path = '.gitifact/config.json') {
      const output = (await git(['check-ignore', '--no-index', '-v', '-z', '--stdin'], root, [0, 1], Buffer.from(path + '\0'))).toString('utf8');
      const fields = output.split('\0');
      if (output && fields[2] && !fields[2].startsWith('!')) throw new InitError('CONFIG_IGNORED', '설정이 ignore 규칙으로 제외됩니다: ' + fields[0] + ':' + fields[1] + ' ' + fields[2]);
    },
    async validateBaseline(config: Pick<ProjectConfig, 'baseline'>, root: string, commit: string | null, format: string) {
      if (config.baseline.kind === 'empty') return;
      const baseline = config.baseline;
      if (!commit || baseline.objectFormat !== format) throw new InitError('BASELINE_UNAVAILABLE', '기준선과 현재 저장소가 일치하지 않습니다.');
      try {
        if (decodeGitLine(await git(['cat-file', '-t', baseline.commit], root)) !== 'commit') throw new Error('not a commit');
        await git(['merge-base', '--is-ancestor', baseline.commit, commit], root);
      } catch { throw new InitError('BASELINE_UNAVAILABLE', '기준선 커밋의 존재와 조상 관계를 확인하지 못했습니다. 기준선을 보존하고 이력을 확인하세요.'); }
    },
  };
}
