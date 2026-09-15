import { parsePreviewFiles, SpecPreviewError, parseProjectConfig, recordPathPattern, STORE_DIRS, type PreviewSpec } from '@gitifact/core';
import { createGitRunner } from './run-git.js';
import { commandScoped } from './command-scope.js';

export function specPreviewReader(cwd: string) {
  // Avoid repository/index overrides and replacements when reading immutable commits.
  for (const key of Object.keys(process.env)) if (/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_PARAMETERS|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) {
    throw new SpecPreviewError('Git 컨텍스트를 덮어쓰는 환경에서는 조회하지 않습니다.');
  }
  const runner = createGitRunner();
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '0', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0', LC_ALL: 'C' };
  const git = (args: string[], input?: Buffer, acceptedExitCodes = [0]) => runner(['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes, ...(input ? { input } : {}),
  });
  const decode = (bytes: Buffer) => {
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new SpecPreviewError('UTF-8 원문이 아닙니다.'); }
  };
  return {
    async index() {
      const output = decode(await git(['ls-files', '--stage', '-z', '--', ...STORE_DIRS.map(d => d + '/spec/')]));
      const files = new Map<string, string>();
      for (const row of output.split('\0').filter(Boolean)) {
        const match = /^(\d+) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/.exec(row);
        if (!match) throw new SpecPreviewError('잘못된 index 항목입니다.');
        const [, mode, oid, stage, path] = match;
        if (!['100644', '100755'].includes(mode!) || stage !== '0') throw new SpecPreviewError('명세 staging에 충돌 또는 링크가 있습니다.');
        if (!recordPathPattern.test(path!)) throw new SpecPreviewError('명세 staging에 지원하지 않는 파일이 있습니다.');
        files.set(path!, oid!);
      }
      return files;
    },
    async hasUnmerged() {
      return (await git(['ls-files', '--unmerged', '-z'])).length > 0;
    },
    async baseline() {
      // HEAD^{commit} verifies the object type in the same process; a non-commit HEAD falls through to the corruption check.
      const [headOutput, branchOutput] = await Promise.all([
        git(['rev-parse', '--verify', '--quiet', '--end-of-options', 'HEAD^{commit}'], undefined, [0, 1]),
        git(['symbolic-ref', '--quiet', 'HEAD'], undefined, [0, 1]),
      ]);
      const head = decode(headOutput).trim(); const branch = decode(branchOutput).trim();
      if (head) {
        if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new SpecPreviewError('HEAD를 확인하지 못했습니다.');
        return { head, branch: branch || null };
      }
      if (!branch.startsWith('refs/heads/') || (await git(['for-each-ref', '--format=%(refname)', '--', branch])).length) throw new SpecPreviewError('손상된 HEAD를 빈 저장소로 처리하지 않습니다.');
      return { head: null, branch };
    },
    location() {
      return commandScoped('spec-location\0' + cwd, async () => {
        const fields = [['--show-toplevel'], ['--absolute-git-dir'], ['--git-path', 'index'], ['--show-object-format']];
        const line = (bytes: Buffer) => decode(bytes).replace(/\n$/, '');
        let values = line(await git(['rev-parse', '--path-format=absolute', ...fields.flat()])).split('\n');
        // A legal POSIX path can contain newlines. Read fields individually instead of guessing boundaries.
        if (values.length !== fields.length) values = await Promise.all(fields.map(async flags => line(await git(['rev-parse', '--path-format=absolute', ...flags]))));
        const [root, gitDir, indexPath, objectFormat] = values.map(value => value.trim()) as [string, string, string, string];
        if (objectFormat !== 'sha1' && objectFormat !== 'sha256') throw new SpecPreviewError('지원하지 않는 Git 객체 형식입니다.');
        return { root, gitDir, indexPath, objectFormat };
      });
    },
    async resolve(ref: string) {
      const oid = (await git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'])).toString('ascii').trim();
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)) throw new SpecPreviewError('커밋을 확인하지 못했습니다.');
      return oid;
    },
    async files(oid: string, allowLegacyBaseline = false): Promise<Map<string, string>> {
      const entries = decode(await git(['ls-tree', '--full-tree', '-r', '-z', oid, '--', ...STORE_DIRS.map(d => d + '/spec/')]));
      const files = new Map<string, string>();
      let legacy: string | undefined;
      for (const row of entries.split('\0').filter(Boolean)) {
        const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(row);
        if (!match) throw new SpecPreviewError('잘못된 Git tree입니다.');
        const [, mode, type, object, path] = match;
        if (!['100644', '100755'].includes(mode!) || type !== 'blob') throw new SpecPreviewError('명세 영역에 링크 또는 서브모듈이 있습니다: ' + path);
        if (!/(?:requirements\.md|design\.md|history\.jsonl|tryce\.json)$/.test(path!)) continue;
        if (path!.endsWith('/tryce.json')) {
          if (!allowLegacyBaseline) throw new SpecPreviewError('기존 JSON 형식은 req 명령으로 조회하세요. 이 명령은 전환하지 않습니다.');
          legacy = path!.split('/')[0]; continue;
        }
        if (!recordPathPattern.test(path!) || !['100644', '100755'].includes(mode!) || type !== 'blob') throw new SpecPreviewError('지원하지 않는 경로 또는 파일 종류: ' + path);
        files.set(path!, object!);
      }
      if (new Set([...files.keys()].map(p => p.split('/')[0])).size > 1) throw new SpecPreviewError('과거 커밋에 .gitifact와 .tryce 명세가 함께 있습니다. 전환 커밋을 확인하세요.');
      if (legacy) {
        if (files.size) throw new SpecPreviewError('과거 커밋에 신구 명세가 혼합돼 있습니다.');
        parseProjectConfig(decode(await git(['show', `${oid}:${legacy}/config.json`])));
      }
      if (files.size > 2000) throw new SpecPreviewError('검토 조회 파일 한도를 초과했습니다.');
      const blobs = new Map<string, string>(); const ids = [...new Set(files.values())]; let totalBytes = 0;
      for (let i = 0; i < ids.length; i += 128) {
        const batch = ids.slice(i, i + 128);
        const output = await git(['cat-file', '--batch'], Buffer.from(batch.join('\n') + '\n')); let offset = 0;
        for (const id of batch) {
          const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString('ascii').split(' '); const size = Number(header[2]);
          if (end < offset || header[0] !== id || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0 || size > 1024 * 1024 || output[end + size + 1] !== 10) throw new SpecPreviewError('검토 조회 blob 형식 또는 1 MiB 한도를 확인하세요.');
          totalBytes += size;
          if (totalBytes > 16 * 1024 * 1024) throw new SpecPreviewError('명세 전체 조회 16 MiB 한도를 초과했습니다.');
          blobs.set(id, decode(output.subarray(end + 1, end + size + 1))); offset = end + size + 2;
        }
        if (offset !== output.length) throw new SpecPreviewError('Git blob 응답 경계가 다릅니다.');
      }
      return new Map([...files].map(([path, id]) => [path, blobs.get(id)!]));
    },
    async read(oid: string): Promise<PreviewSpec[]> {
      const files = await this.files(oid);
      return parsePreviewFiles(files);
    },
  };
}
