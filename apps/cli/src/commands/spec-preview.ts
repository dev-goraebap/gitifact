import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { comparePreviewBundles, SpecPreviewError, RepositoryReadError, InitError, parseManagedConfig } from '@gitifact/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { withCommandScope } from '../adapters/git/command-scope.js';
import { readWorkingPreview, saveWorkingPreview } from '../adapters/filesystem/spec-preview-store.js';
import { readFinalPreviewChanges } from './spec-preview-context.js';
import { fileInfo, readConfigFile } from '../adapters/filesystem/config-file.js';
import { initRepository } from '../adapters/git/init-repository.js';
import { discardAgentInput, prepareAgentInputs, type AgentInputControls } from '../adapters/filesystem/agent-inputs.js';
import { specCommit } from './spec-commit.js';
import { t } from '../shared/i18n/index.js';

type Action = 'read' | 'diff' | 'working' | 'save' | 'changes' | 'commit';
type Options = { ref?: string; from?: string; to?: string; file?: string; dryRun?: boolean; stamp?: boolean; feature?: string; ids?: boolean };
export interface SpecPreviewControls extends AgentInputControls { stdin?: AsyncIterable<Uint8Array> }
const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock'];

// One scope per command lets nested reads share the repository location instead of spawning Git again.
export const runSpecPreview = (action: Action, options: Options, controls: SpecPreviewControls = {}) => withCommandScope(() => execute(action, options, controls));

async function execute(action: Action, options: Options, controls: SpecPreviewControls) {
  const envelope = { contract: 'spec', version: 1 };
  try {
    // Same guards as the full repository inspection, using only the Git reads they need.
    const guard = specPreviewReader(process.cwd()); const { root, gitDir, objectFormat } = await guard.location();
    for (const marker of operations) if (await fileInfo(join(gitDir, marker))) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.operationInProgress', { marker }));
    if (await guard.hasUnmerged()) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.resolveConflicts'));
    const raw = await readConfigFile(root);
    if (raw === undefined) throw new SpecPreviewError(t('preview.notInitialized'));
    const config = parseManagedConfig(raw);
    await initRepository(root).validateBaseline(config, root, 'HEAD', objectFormat);
    if (['working', 'save', 'changes', 'commit'].includes(action)) {
      let result;
      // The input paths ride on the reads an agent already runs before save and commit; a failure only omits them.
      const inputs = () => prepareAgentInputs(root, controls).catch(() => undefined);
      if (action === 'working') result = narrowWorking(await readWorkingPreview({ root, gitDir }), options, await inputs());
      else if (action === 'changes') result = { ...await readFinalPreviewChanges(process.cwd()), inputs: await inputs() };
      else {
        const bytes = options.file === '-' ? await readStdin(controls.stdin ?? process.stdin) : await readInputFile(options.file!);
        if (bytes.length > 1024 * 1024) throw new SpecPreviewError(t('preview.inputSize'));
        let input: unknown;
        try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw new SpecPreviewError(t('preview.inputJson')); }
        result = action === 'commit' ? await specCommit(process.cwd(), input, !!options.dryRun)
          : await saveWorkingPreview({ root, gitDir }, input);
        // Only a certain success consumes the input; failures, dry runs and uncertain commits keep it for the retry.
        const consumed = action === 'save' || (action === 'commit' && (result as { outcome?: string }).outcome === 'committed');
        if (consumed && options.file !== '-') result = { ...result, inputRemoved: await discardAgentInput(root, options.file!, controls) };
      }
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, ...result }) + '\n'); return;
    }
    const reader = specPreviewReader(process.cwd());
    if (action === 'read') {
      const commit = await reader.resolve(options.ref ?? 'HEAD');
      const bundle = await reader.readBundle(commit);
      process.stdout.write(JSON.stringify({ ...envelope, ok: true, commit, specs: bundle.specs, wiki: bundle.wiki }) + '\n');
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

async function readInputFile(path: string) {
  const source = await stat(path);
  if (!source.isFile() || source.size > 1024 * 1024) throw new SpecPreviewError(t('preview.inputFile'));
  return readFile(path);
}

async function readStdin(stream: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new SpecPreviewError(t('preview.inputSize'));
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

type Working = Awaited<ReturnType<typeof readWorkingPreview>>;
type Inputs = Awaited<ReturnType<typeof prepareAgentInputs>>;
/** Smaller working views so agents read what they need instead of keeping the full output in a file. */
function narrowWorking(working: Working, options: Options, inputs: Inputs) {
  if (options.stamp) return { stamp: working.stamp, inputs };
  let { specs, wiki, warnings } = working;
  if (options.feature !== undefined) {
    specs = specs.filter(s => s.path === '.gitifact/spec/' + options.feature + '/requirements.md');
    if (!specs.length) throw new SpecPreviewError(t('preview.unknownFeature', { feature: options.feature }));
    wiki = { documents: [], history: [] }; warnings = warnings.filter(w => w.code === 'MISSING_DESIGN_REFERENCE' && w.specId === specs[0]!.id);
  }
  if (!options.ids) return { stamp: working.stamp, inputs, specs, wiki, warnings };
  return { stamp: working.stamp, inputs, warnings,
    specs: specs.map(s => ({ id: s.id, path: s.path, title: s.title, design: s.design?.title ?? null, requirements: s.requirements.map(r => ({ id: r.id, title: r.title })) })),
    wiki: { documents: wiki.documents.map(d => ({ id: d.id, path: d.path, title: d.title })) } };
}
