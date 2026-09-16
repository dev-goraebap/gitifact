import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { comparePreviewBundles, SpecPreviewError, RepositoryReadError, InitError, parseManagedConfig } from '@gitifact/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { withCommandScope } from '../adapters/git/command-scope.js';
import { readWorkingPreview, saveWorkingPreview } from '../adapters/filesystem/spec-preview-store.js';
import { prepareWorkingPreview, readFinalPreviewChanges, verifyPreparedPreview } from '../adapters/filesystem/spec-preview-prepare.js';
import { fileInfo, readConfigFile } from '../adapters/filesystem/config-file.js';
import { initRepository } from '../adapters/git/init-repository.js';
import { previewCommit } from './spec-preview-commit.js';
import { specCommit } from './spec-commit.js';

type Action = 'read' | 'diff' | 'working' | 'save' | 'changes' | 'prepare' | 'verify' | 'commit-plan' | 'commit-apply' | 'commit';
type Options = { ref?: string; from?: string; to?: string; file?: string; staged?: boolean; dryRun?: boolean };
const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock'];

// One scope per command lets nested reads share the repository location instead of spawning Git again.
export const runSpecPreview = (action: Action, options: Options) => withCommandScope(() => execute(action, options));

async function execute(action: Action, options: Options) {
  const envelope = { contract: 'spec', version: 1 };
  try {
    // Same guards as the full repository inspection, using only the Git reads they need.
    const guard = specPreviewReader(process.cwd()); const { root, gitDir, objectFormat } = await guard.location();
    for (const marker of operations) if (await fileInfo(join(gitDir, marker))) throw new InitError('GIT_OPERATION_IN_PROGRESS', 'Git 작업이 진행 중입니다: ' + marker);
    if (await guard.hasUnmerged()) throw new InitError('GIT_OPERATION_IN_PROGRESS', 'Git 충돌을 먼저 해결하세요.');
    const raw = await readConfigFile(root);
    if (raw === undefined) throw new SpecPreviewError('먼저 gitifact init으로 초기화하세요.');
    const config = parseManagedConfig(raw);
    if (!('schemaVersion' in config)) throw new SpecPreviewError('기존 프로젝트는 별도 전환이 필요합니다.');
    await initRepository(root).validateBaseline(config, root, 'HEAD', objectFormat);
    if (['working', 'save', 'changes', 'prepare', 'verify', 'commit-plan', 'commit-apply', 'commit'].includes(action)) {
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
        result = action === 'commit' ? await specCommit(process.cwd(), input, !!options.dryRun)
          : action === 'commit-plan' || action === 'commit-apply' ? await previewCommit(process.cwd(), action === 'commit-plan' ? 'plan' : 'apply', input)
          : action === 'prepare' ? await prepareWorkingPreview(process.cwd(), input)
          : action === 'verify' ? await verifyPreparedPreview(process.cwd(), input, !!options.staged)
          : await saveWorkingPreview(process.cwd(), input);
      }
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, ...result }) + '\n'); return;
    }
    const reader = specPreviewReader(process.cwd());
    if (action === 'read') {
      const commit = await reader.resolve(options.ref ?? 'HEAD');
      const bundle = await reader.readBundle(commit);
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, commit, specs: bundle.specs, documents: bundle.documents }) + '\n');
    } else {
      const [from, to] = await Promise.all([reader.resolve(options.from!), reader.resolve(options.to!)]);
      const [before, after] = await Promise.all([reader.readBundle(from), reader.readBundle(to)]);
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, from, to, ...comparePreviewBundles(before, after) }) + '\n');
    }
  } catch (error) {
    const known = error instanceof SpecPreviewError || error instanceof RepositoryReadError || error instanceof InitError;
    process.stderr.write(JSON.stringify({ ...envelope, ok: false, error: { code: known ? error.code : 'SPEC_PREVIEW_FAILED', message: known ? error.message : '검토 명세 작업에 실패했습니다.' } }) + '\n');
    process.exitCode = 1;
  }
}
