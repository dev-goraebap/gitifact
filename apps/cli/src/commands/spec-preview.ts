import { compareSpecPreviews, SpecPreviewError, RepositoryReadError } from '@tryce/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { readWorkingPreview, saveWorkingPreview } from '../adapters/filesystem/spec-preview-store.js';
import { readFile, stat } from 'node:fs/promises';
import { prepareWorkingPreview, readFinalPreviewChanges, verifyPreparedPreview } from '../adapters/filesystem/spec-preview-prepare.js';
import { previewCommit } from './spec-preview-commit.js';
import { InitError, parseManagedConfig } from '@tryce/core';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { initRepository } from '../adapters/git/init-repository.js';

export async function runSpecPreview(action: 'read' | 'diff' | 'working' | 'save' | 'changes' | 'prepare' | 'verify' | 'commit-plan' | 'commit-apply', options: { experimental?: boolean; ref?: string; from?: string; to?: string; file?: string; staged?: boolean }, managed = false) {
  const envelope = managed ? { contract: 'spec', version: 1 } : { contract: 'spec-preview', version: 'experimental' };
  try {
    if (managed) {
      const repo = initRepository(process.cwd()); const state = await repo.inspect();
      const raw = await readConfigFile(state.state.repository.rootPath);
      if (raw === undefined) throw new SpecPreviewError('먼저 tryce init으로 초기화하세요.');
      const config = parseManagedConfig(raw);
      if (config.format !== 'spec-1') throw new SpecPreviewError('기존 프로젝트는 별도 전환이 필요합니다.');
      await repo.validateBaseline(config, state.state.repository.rootPath, state.state.head.commit, state.state.repository.objectFormat);
    }
    if (!options.experimental) throw new SpecPreviewError('--experimental이 필요한 검토용 기능입니다.');
    if (['working', 'save', 'changes', 'prepare', 'verify', 'commit-plan', 'commit-apply'].includes(action)) {
      let result;
      if (action === 'working') result = await readWorkingPreview(process.cwd());
      else if (action === 'changes') result = await readFinalPreviewChanges(process.cwd());
      else {
        const source = await stat(options.file!);
        if (!source.isFile() || source.size > 1024 * 1024) throw new SpecPreviewError('입력은 1 MiB 이하의 JSON 파일이어야 합니다.');
        const bytes = await readFile(options.file!);
        if (bytes.length > 1024 * 1024) throw new SpecPreviewError('입력 크기를 초과했습니다.');
        let input: unknown;
        try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw new SpecPreviewError('입력 파일은 UTF-8 JSON이어야 합니다.'); }
        result = action === 'commit-plan' || action === 'commit-apply' ? await previewCommit(process.cwd(), action === 'commit-plan' ? 'plan' : 'apply', input)
          : action === 'prepare' ? await prepareWorkingPreview(process.cwd(), input)
          : action === 'verify' ? await verifyPreparedPreview(process.cwd(), input, !!options.staged)
          : await saveWorkingPreview(process.cwd(), input);
      }
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, ...result }) + '\n'); return;
    }
    const reader = specPreviewReader(process.cwd());
    if (action === 'read') {
      const commit = await reader.resolve(options.ref ?? 'HEAD');
      const specs = await reader.read(commit);
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, commit, specs }) + '\n');
    } else {
      const [from, to] = await Promise.all([reader.resolve(options.from!), reader.resolve(options.to!)]);
      const [before, after] = await Promise.all([reader.read(from), reader.read(to)]);
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, from, to, ...compareSpecPreviews(before, after) }) + '\n');
    }
  } catch (error) {
    const known = error instanceof SpecPreviewError || error instanceof RepositoryReadError || error instanceof InitError;
    process.stderr.write(JSON.stringify({ ...envelope, ok: false, error: { code: known ? error.code : 'SPEC_PREVIEW_FAILED', message: known ? error.message : '검토 명세 작업에 실패했습니다.' } }) + '\n');
    process.exitCode = 1;
  }
}
