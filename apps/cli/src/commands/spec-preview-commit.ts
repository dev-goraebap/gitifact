import { createHash, randomUUID } from 'node:crypto';
import { readFile, lstat, mkdir, open, rename, unlink, rmdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { SpecPreviewError } from '@gitifact/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { createGitRunner } from '../adapters/git/run-git.js';
import { readWorkingPreviewState, readLockedPreviewState } from '../adapters/filesystem/spec-preview-store.js';
import { readFinalPreviewChanges, verifyPreparedPreview } from '../adapters/filesystem/spec-preview-prepare.js';
import { checkLegacySelection, fail, fingerprint, hash, info, object, optional, paths, policyPaths, record, text } from './spec-commit-files.js';
import { t } from '../shared/i18n/index.js';

// Deprecated since spec commit; remove in 0.6.0.
type Entry = { path: string; hash: string | null };
type Plan = { kind: 'spec-preview-commit'; root: string; verification: unknown; index: string;
  files: Entry[]; context: Entry[]; message: string; requirements: string[]; authorization: { basis: string; evidence: string }; digest: string };
const seal = (p: Omit<Plan, 'digest'>) => hash(JSON.stringify(p));

export async function previewCommit(cwd: string, action: 'plan' | 'apply', input: unknown): Promise<
  { outcome: 'planned'; plan: Plan; committed: false } | { outcome: 'committed'; commit: string | null; paths: string[]; requirements: string[]; pushed: false }
> {
  const reader = specPreviewReader(cwd); const { root, gitDir } = await reader.location();
  const runner = createGitRunner();
  const git = (args: string[], index?: string) => runner(['-c', 'core.fsmonitor=false', ...args], { cwd: root,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0',
      GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) },
    timeoutMs: 120000, maxBytes: 32 * 1024 * 1024 });
  const indexPath = (await git(['rev-parse', '--path-format=absolute', '--git-path', 'index'])).toString('utf8').trim();
  const staged = async (index?: string) => (await git(['diff', '--cached', '--ita-visible-in-index', '--name-only', '--no-renames', '-z'], index)).toString('utf8').split('\0').filter(Boolean).sort();
  const busy = join(gitDir, 'gitifact-spec-commit.lock');
  if (await info(busy)) fail(t('commit.busy', { path: busy }));
  if ((await staged()).length) fail(t('commit.existingStagingPlan'));
  const request = object(input); let plan: Plan;
  if (action === 'plan') {
    if (Object.keys(request).some(k => !['verification', 'paths', 'message', 'requirements', 'authorization', 'policyFiles'].includes(k))) fail(t('commit.unknownField'));
    await verifyPreparedPreview(cwd, request.verification, false);
    const selected = paths(request.paths); const authorization = object(request.authorization);
    await checkLegacySelection(root, selected);
    if (Object.keys(authorization).sort().join(',') !== 'basis,evidence' || !['user-request', 'project-policy'].includes(String(authorization.basis))) fail(t('commit.authorizationRequired'));
    const message = text(request.message, 4000); if (/^\s*Gitifact-/im.test(message)) fail(t('commit.trailerInMessage'));
    const state = await readWorkingPreviewState(cwd); const base = await reader.baseline(); const previous = base.head ? await reader.files(base.head, state.config !== undefined) : new Map<string, string>();
    const pending = [...new Set([...previous.keys(), ...state.files.keys()])].filter(p => previous.get(p) !== state.files.get(p));
    if (pending.some(p => !selected.includes(p))) fail(t('commit.selectPending'));
    const delta = await readFinalPreviewChanges(cwd);
    const references = request.requirements ?? [];
    if (!Array.isArray(references) || references.length > 1000 || references.some(r => typeof r !== 'string')) fail(t('commit.invalidReferences'));
    if (delta.changes.some(c => c.kind === 'design')) fail(t('commit.designUseSpecCommit'));
    const known = new Set([...state.specs.flatMap(s => s.requirements.map(r => r.id)), ...delta.changes.map(c => c.id)]);
    if ((references as string[]).some(r => !known.has(r))) fail(t('commit.unknownRequirement'));
    const extra = request.policyFiles === undefined ? [] : paths(request.policyFiles, 1024);
    const contents = async (list: string[]) => Promise.all(list.map(async path => ({ path, hash: await fingerprint(root, path) })));
    const data = { kind: 'spec-preview-commit' as const, root, verification: request.verification,
      index: hash(await optional(indexPath) ?? Buffer.alloc(0)), files: await contents(selected), context: await contents([...new Set([...policyPaths(selected), ...extra])].sort()),
      message, requirements: [...new Set([...references as string[], ...delta.changes.map(c => c.id)])].sort(),
      authorization: { basis: String(authorization.basis), evidence: text(authorization.evidence, 2000) } };
    await verifyPreparedPreview(cwd, request.verification, false);
    if (data.index !== hash(await optional(indexPath) ?? Buffer.alloc(0)) || (await staged()).length) fail(t('commit.indexChangedPlanning'));
    return { outcome: 'planned', plan: { ...data, digest: seal(data) }, committed: false };
  }
  const { digest, ...data } = request;
  if (request.kind !== 'spec-preview-commit' || typeof digest !== 'string' || digest !== seal(data as Omit<Plan, 'digest'>)) fail(t('commit.planCorrupted'));
  plan = request as unknown as Plan;
  if (plan.root !== root || !Array.isArray(plan.files) || !Array.isArray(plan.context)) fail(t('commit.planScope'));
  const selected = paths(plan.files.map(f => f.path));
  // Rebuild from current inputs to validate all fields, references, policies and file hashes.
  const refreshed = await previewCommit(cwd, 'plan', { verification: plan.verification, paths: selected, message: plan.message,
    requirements: plan.requirements, authorization: plan.authorization, policyFiles: plan.context.map(f => f.path) });
  if (!('plan' in refreshed) || refreshed.plan.digest !== plan.digest) fail(t('commit.planStale'));
  const before = await reader.baseline(); const original = await optional(indexPath);
  await mkdir(busy); const draftLock = join(gitDir, 'gitifact-spec-preview.lock');
  let draftOwned = false; let indexLock: Awaited<ReturnType<typeof open>> | undefined;
  let uncertain = false; let commitStarted = false; const temporary = join(gitDir, 'gitifact-commit-index-' + randomUUID());
  const checkFiles = async () => {
    for (const f of [...plan.files, ...plan.context]) if (f.hash !== await fingerprint(root, f.path)) fail(t('commit.fileChangedPreparing', { path: f.path }));
    if ((await readLockedPreviewState(root)).stamp !== object(plan.verification).stamp) fail(t('commit.specsChangedPreparing'));
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) if (await info(join(gitDir, name))) fail(t('commit.integrationStarted'));
  };
  try {
    await verifyPreparedPreview(cwd, plan.verification, false);
    await mkdir(draftLock); draftOwned = true;
    indexLock = await open(indexPath + '.lock', 'wx', 0o600);
    if (plan.index !== hash(await optional(indexPath) ?? Buffer.alloc(0)) || (await staged()).length) fail(t('commit.indexChangedLocked'));
    await writeFile(join(busy, 'recovery.json'), JSON.stringify({ before, originalIndex: original?.toString('base64') ?? null, temporary, plan }));
    if (original) await writeFile(temporary, original, { flag: 'wx' }); else await git(['read-tree', '--empty'], temporary);
    await git(['add', '--', ...selected], temporary);
    const actual = await staged(temporary);
    if (!actual.length || actual.some(p => !selected.includes(p))) fail(t('commit.unexpectedFiles'));
    for (const file of plan.files.filter(f => record(f.path) && f.hash !== null)) {
      const stagedBytes = await git(['show', ':' + file.path], temporary);
      if (!stagedBytes.equals(await readFile(join(root, file.path)))) fail(t('commit.filterChanged'));
    }
    await checkFiles(); if (JSON.stringify(before) !== JSON.stringify(await reader.baseline())) fail(t('commit.headChanged'));
    const tree = (await git(['write-tree'], temporary)).toString('utf8').trim();
    const trailers = plan.requirements.map(id => 'Gitifact-Req: ' + id);
    commitStarted = true;
    await git(['commit', '-m', plan.message.trim() + (trailers.length ? '\n\n' + trailers.join('\n') : '')], temporary);
    const after = await reader.baseline();
    const actualTree = (await git(['rev-parse', 'HEAD^{tree}'])).toString('utf8').trim();
    const parents = (await git(['rev-list', '--parents', '-n', '1', 'HEAD'])).toString('utf8').trim().split(' ').slice(1);
    const message = (await git(['log', '-1', '--format=%B'])).toString('utf8');
    if (actualTree !== tree || after.branch !== before.branch || JSON.stringify(parents) !== JSON.stringify(before.head ? [before.head] : [])
      || trailers.some(t => !message.split(/\r?\n/).includes(t))) fail(t('commit.resultAltered'));
    if (hash(await optional(indexPath) ?? Buffer.alloc(0)) !== plan.index) fail(t('commit.indexChangedAfter'));
    if ((await git(['write-tree'], temporary)).toString('utf8').trim() !== tree) fail(t('commit.hookChangedStaging'));
    // Preserve unrelated index flags while publishing only the verified commit's index.
    await indexLock.writeFile(await readFile(temporary)); await indexLock.sync(); await indexLock.close();
    await rename(indexPath + '.lock', indexPath); indexLock = undefined;
    return { outcome: 'committed', commit: after.head, paths: actual, requirements: plan.requirements, pushed: false };
  } catch (error) {
    if (commitStarted) { try { uncertain = JSON.stringify(before) !== JSON.stringify(await reader.baseline()); } catch { uncertain = true; } }
    if (uncertain) fail(t('commit.uncertain', { path: busy }));
    throw error;
  } finally {
    await indexLock?.close().catch(() => {});
    if (!uncertain) {
      if (indexLock) await unlink(indexPath + '.lock').catch(() => {});
      await unlink(temporary).catch(() => {}); await unlink(join(busy, 'recovery.json')).catch(() => {}); await rmdir(busy);
      if (draftOwned) await rmdir(draftLock);
    }
  }
}
