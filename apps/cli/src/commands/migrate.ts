import { lstat, readdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { InitError, parseManagedConfig, parsePreviewFiles, RepositoryReadError, SpecPreviewError } from '@gitifact/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { withCommandScope } from '../adapters/git/command-scope.js';
import { LEGACY_LOCKS } from '../adapters/filesystem/spec-preview-store.js';
import { t } from '../shared/i18n/index.js';

const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START', 'index.lock'];
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const fail = (code: string, message: string): never => { throw new InitError(code, message); };

/**
 * Moves a Tryce checkout to the Gitifact store: `.tryce` becomes `.gitifact` and the `tryce-*` markers at
 * line starts become `gitifact-*`. IDs, reasons, config and committed history are untouched; the caller
 * commits the result with `spec commit`. Skills and ignore rules are reported, not rewritten.
 */
export async function migrateStore(cwd: string, dryRun = false) {
  const reader = specPreviewReader(cwd); const { root, gitDir } = await reader.location();
  for (const marker of operations) if (await info(join(gitDir, marker))) fail('GIT_OPERATION_IN_PROGRESS', t('git.operationInProgress', { marker }));
  if (await reader.hasUnmerged()) fail('GIT_OPERATION_IN_PROGRESS', t('git.resolveConflicts'));
  for (const name of [...LEGACY_LOCKS, 'gitifact-spec-preview.lock', 'gitifact-spec-commit.lock']) if (await info(join(gitDir, name))) fail('LOCKED', t('migrate.locked', { path: join(gitDir, name) }));
  const from = join(root, '.tryce'); const to = join(root, '.gitifact');
  const fromInfo = await info(from);
  if (await info(to)) fail('ALREADY_MIGRATED', t('migrate.alreadyMigrated'));
  if (!fromInfo) return fail('NOTHING_TO_MIGRATE', t('migrate.nothingToMigrate'));
  if (!fromInfo.isDirectory() || fromInfo.isSymbolicLink()) fail('PATH_CONFLICT', t('migrate.notDirectory'));
  const configInfo = await info(join(from, 'config.json'));
  if (!configInfo?.isFile() || configInfo.isSymbolicLink()) fail('NOT_INITIALIZED', t('migrate.noConfig'));
  const config = parseManagedConfig(decode(await readFile(join(from, 'config.json'))));
  if (!('schemaVersion' in config)) fail('UNSUPPORTED_FORMAT', t('migrate.legacyJson'));
  const top = (await readdir(from)).sort();
  if (top.some(name => name !== 'config.json' && name !== 'spec')) fail('UNSUPPORTED_FORMAT', t('migrate.extraEntries'));
  const files = new Map<string, string>(); const rewrites: { path: string; content: string }[] = []; const legacyRecords: string[] = [];
  const marker = /^<!-- tryce-(spec|req|design|ref): /;
  if (top.includes('spec')) {
    for (const feature of (await readdir(join(from, 'spec'))).sort()) {
      const dir = join(from, 'spec', feature); const stat = await info(dir);
      if (!stat?.isDirectory() || stat.isSymbolicLink()) fail('UNSUPPORTED_FORMAT', t('migrate.notSpecFolder', { feature }));
      for (const name of (await readdir(dir)).sort()) {
        if (!['requirements.md', 'design.md', 'history.jsonl', 'tryce.json'].includes(name)) fail('UNSUPPORTED_FORMAT', t('migrate.unsupportedFile', { feature, name }));
        const fileStat = await info(join(dir, name));
        if (!fileStat?.isFile() || fileStat.isSymbolicLink() || fileStat.nlink !== 1 || fileStat.size > 1024 * 1024) fail('UNSUPPORTED_FORMAT', t('migrate.fileTooLarge', { name }));
        const newPath = `.gitifact/spec/${feature}/${name}`;
        // Old JSON records are moved untouched; `spec commit` may only select them for deletion.
        if (name === 'tryce.json') { legacyRecords.push(newPath); continue; }
        const text = decode(await readFile(join(dir, name)));
        if (name === 'history.jsonl') { files.set(newPath, text); continue; }
        // Same fence rule as the parser: examples inside code blocks are prose and stay as written.
        let fence: { char: string; size: number } | undefined;
        const next = text.split('\n').map(line => {
          if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
          const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
          if (open) { fence = { char: open[1]![0]!, size: open[1]!.length }; return line; }
          return marker.test(line) ? line.replace(/^<!-- tryce-/, '<!-- gitifact-') : line;
        }).join('\n');
        files.set(newPath, next);
        if (next !== text) rewrites.push({ path: newPath, content: next });
      }
    }
  }
  // The rewritten set must parse as a complete Gitifact store before anything is moved.
  const specs = parsePreviewFiles(files);
  const result = (outcome: 'planned' | 'migrated') => ({ contract: 'migrate', version: 1, ok: true, outcome, rootPath: root, from: '.tryce', to: '.gitifact',
    specs: specs.map(s => ({ id: s.id, path: s.path, requirements: s.requirements.length, history: s.history.length, design: !!s.design })),
    rewritten: rewrites.map(r => r.path), legacyRecords,
    next: [t('migrate.nextCommit'),
      ...(legacyRecords.length ? [t('migrate.nextLegacyJson')] : []),
      t('migrate.nextSkills'),
      t('migrate.nextRename')] });
  if (dryRun) return result('planned');
  await rename(from, to);
  for (const r of rewrites) {
    const full = join(root, r.path); const temp = join(root, '.gitifact', 'spec', '.gitifact-migrate-' + randomBytes(8).toString('hex'));
    await writeFile(temp, r.content, { flag: 'wx' });
    try { await rename(temp, full); } finally { await unlink(temp).catch(() => {}); }
  }
  return result('migrated');
}

export async function runMigrate(options: { dryRun?: boolean }) {
  try {
    const dto = await withCommandScope(() => migrateStore(process.cwd(), !!options.dryRun));
    process.stdout.write(JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof SpecPreviewError || error instanceof RepositoryReadError;
    process.stderr.write(JSON.stringify({ contract: 'migrate', version: 1, ok: false, error: { code: known ? error.code : 'MIGRATE_FAILED', message: known ? error.message : t('migrate.failed') } }) + '\n');
    process.exitCode = 1;
  }
}
