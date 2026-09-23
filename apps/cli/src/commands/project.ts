import { join } from 'node:path';
import { InitError, parseManagedConfig, parseDocumentFile, classifyDocPath, type Doc } from '@gitifact/core';
import { storeReader } from '../adapters/git/store-reader.js';
import { openCache } from '../adapters/cache/index.js';
import { fileInfo, readConfigFile } from '../adapters/filesystem/config-file.js';
import { CommandError } from './output.js';
import { t } from '../shared/i18n/index.js';

const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock'];

/**
 * The project a `docs` or `changes` command works on: where the repository is, its configuration in the current
 * format, and the cache. Writing commands also refuse to run while Git is in the middle of another operation.
 */
export async function openProject(cwd: string, options: { writing?: boolean } = {}) {
  const reader = storeReader(cwd);
  const location = await reader.location();
  if (options.writing) {
    for (const marker of operations) if (await fileInfo(join(location.gitDir, marker))) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.operationInProgress', { marker }));
    if (await reader.hasUnmerged()) throw new InitError('GIT_OPERATION_IN_PROGRESS', t('git.resolveConflicts'));
  }
  const raw = await readConfigFile(location.root);
  if (raw === undefined) throw new CommandError('NOT_INITIALIZED', t('project.notInitialized'));
  const config = parseManagedConfig(raw);
  // The 0.7 reader serves the history before a migration; it is read-only and goes with the 0.7 parser at 1.0.0.
  const cache = openCache(location.root, { run: (args, input) => reader.run(args, input), decode: reader.decode, legacyBundles: oids => reader.readBundles(oids) });
  return {
    ...location, reader, config, cache,
    /** The commit HEAD points at, or null in a repository without commits. */
    async head(): Promise<string | null> { return (await reader.baseline()).head; },
  };
}
export type Project = Awaited<ReturnType<typeof openProject>>;

/** The documents among a set of files (path → text); a file that does not parse is left out. */
export function documentsOf(files: ReadonlyMap<string, string>): Doc[] {
  const docs: Doc[] = [];
  for (const [path, source] of files) {
    try { if (classifyDocPath(path).type === 'doc') docs.push(parseDocumentFile(path, source)); } catch { /* reported by docs check */ }
  }
  return docs;
}
