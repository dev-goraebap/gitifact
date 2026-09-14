import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InitError } from '@tryce/core';
import type { ProjectConfig, RepositoryState } from '@tryce/core';
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
        git(['ls-files', '--stage', '-z', '--', '.tryce/config.json'], root),
        state.head.commit ? git(['ls-tree', '-z', state.head.commit, '--', '.tryce/config.json'], root) : Buffer.alloc(0),
      ]) : [Buffer.alloc(0), Buffer.alloc(0)];
      return { state, trackedConfig: staged.length > 0 || committed.length > 0,
        stamp: JSON.stringify({ repository: state.repository, head: state.head, index: createHash('sha256').update(index).digest('hex') }) };
    },
    async trackedPaths(root: string, prefix: string, commit: string | null) {
      const indexed = await git(['ls-files', '-z', '--', prefix], root);
      const committed = commit ? await git(['ls-tree', '-r', '--name-only', '-z', commit, '--', prefix], root) : Buffer.alloc(0);
      return [...new Set(Buffer.concat([indexed, committed]).toString('utf8').split('\0').filter(Boolean))];
    },
    async recordVersions(root: string, path: string, commit: string | null) {
      const versions: string[] = [];
      if ((await git(['ls-files', '-z', '--', path], root)).length) versions.push((await git(['show', ':' + path], root)).toString('utf8'));
      if (commit && (await git(['ls-tree', '-z', commit, '--', path], root)).length) versions.push((await git(['show', commit + ':' + path], root)).toString('utf8'));
      return versions;
    },
    async recordSnapshot(root: string, commit: string | null) {
      const prefixes = ['.tryce/notes/', '.tryce/spec/', 'specs/'];
      const [index, head] = await Promise.all([
        git(['ls-files', '--stage', '-z', '--', ...prefixes], root),
        commit ? git(['ls-tree', '-r', '-z', commit, '--', ...prefixes], root) : Buffer.alloc(0),
      ]);
      const paths = new Set<string>();
      const objects = new Map<string, string[]>();
      for (const [output, staged] of [[index, true], [head, false]] as const) {
        for (const entry of output.toString('utf8').split('\0').filter(Boolean)) {
          const tab = entry.indexOf('\t');
          const header = entry.slice(0, tab).split(' ');
          const path = entry.slice(tab + 1);
          const oid = header[staged ? 1 : 2];
          if (tab < 0 || !oid || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)
            || (staged && header[2] !== '0')) throw new InitError('INVALID_REQUIREMENTS', 'Git 기록 목록을 해석하지 못했습니다.');
          paths.add(path);
          if (/^(?:\.tryce\/spec|specs)\/[^/]+\/tryce\.json$/.test(path)) {
            if (!staged && header[1] !== 'blob') throw new InitError('INVALID_REQUIREMENTS', 'Git 요구사항이 blob이 아닙니다.');
            objects.set(path, [...(objects.get(path) ?? []), oid]);
          }
        }
      }
      const ids = [...new Set([...objects.values()].flat())];
      const blobs = new Map<string, string>();
      for (let start = 0; start < ids.length; start += 32) {
        const batch = ids.slice(start, start + 32);
        // Read raw blobs by object ID; no textconv, filters or path quoting.
        const output = await git(['cat-file', '--batch'], root, [0], Buffer.from(batch.join('\n') + '\n'));
        let offset = 0;
        for (const id of batch) {
          const end = output.indexOf(10, offset);
          const header = output.subarray(offset, end).toString('ascii').split(' ');
          const size = Number(header[2]);
          if (end < offset || header[0] !== id || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0
            || end + 1 + size >= output.length || output[end + 1 + size] !== 10) {
            throw new InitError('INVALID_REQUIREMENTS', 'Git 요구사항 원문을 읽지 못했습니다.');
          }
          blobs.set(id, output.subarray(end + 1, end + 1 + size).toString('utf8'));
          offset = end + size + 2;
        }
        if (offset !== output.length) throw new InitError('INVALID_REQUIREMENTS', 'Git 원문 응답 크기가 다릅니다.');
      }
      return { paths: [...paths], versions: new Map([...objects].map(([path, ids]) => [path, ids.map(id => blobs.get(id)!)])) };
    },
    async checkIgnore(root: string, path = '.tryce/config.json') {
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
