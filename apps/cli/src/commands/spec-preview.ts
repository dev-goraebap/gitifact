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
import { t } from '../shared/i18n/index.js';

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
    for (const marker of operations) if (await fileInfo(join(gitDir, marker))) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.operationInProgress', { marker }));
    if (await guard.hasUnmerged()) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.resolveConflicts'));
    const raw = await readConfigFile(root);
    if (raw === undefined) throw new SpecPreviewError(t('preview.notInitialized'));
    const config = parseManagedConfig(raw);
    if (!('schemaVersion' in config)) throw new SpecPreviewError(t('preview.legacyProject'));
    await initRepository(root).validateBaseline(config, root, 'HEAD', objectFormat);
    if (['working', 'save', 'changes', 'prepare', 'verify', 'commit-plan', 'commit-apply', 'commit'].includes(action)) {
      let result;
      if (action === 'working') result = await readWorkingPreview(process.cwd());
      else if (action === 'changes') result = await readFinalPreviewChanges(process.cwd());
      else {
        const source = await stat(options.file!);
        if (!source.isFile() || source.size > 1024 * 1024) throw new SpecPreviewError(t('preview.inputFile'));
        const bytes = await readFile(options.file!);
        if (bytes.length > 1024 * 1024) throw new SpecPreviewError(t('preview.inputSize'));
        let input: unknown;
        try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw new SpecPreviewError(t('preview.inputJson')); }
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
    process.stderr.write(JSON.stringify({ ...envelope, ok: false, error: { code: known ? error.code : 'SPEC_PREVIEW_FAILED', message: known ? error.message : t('preview.failed') } }) + '\n');
    process.exitCode = 1;
  }
}
