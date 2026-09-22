import { lstat, readdir, readFile, mkdir, writeFile, rename, unlink, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { editSpecPreview, parsePreviewBundle, renderDesignPreview, renderSpecPreview, renderDocument, recordPathPattern, WIKI_DIR, SpecPreviewError, parseManagedConfig } from '@gitifact/core';
import { workingWarnings } from './working-warnings.js';
import { readConfigFile } from './config-file.js';
import { t } from '../../shared/i18n/index.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const info = async (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
export const generatePreviewId = (prefix: 'S' | 'R' | 'H' | 'W') => prefix + '-' + [...randomBytes(10)].map(n => 'abcdefghijklmnopqrstuvwxyz234567'[n & 31]).join('');
/** Where the store lives. Commands resolve it through the Git adapter once and pass it in, so adapters stay independent. */
export interface StoreLocation { root: string; gitDir: string }
/** A failure after Git may have changed HEAD: keep written files and recovery data instead of rolling back. */
export class PreservedPreviewError extends SpecPreviewError {}

async function snapshot(root: string) {
  const files = new Map<string, string>(); let count = 0; let bytes = 0;
  const parent = await info(join(root, '.gitifact'));
  if (parent && (!parent.isDirectory() || parent.isSymbolicLink())) fail(t('store.storeNotDirectory'));
  const config = await readConfigFile(root);
  if (config !== undefined) parseManagedConfig(config);
  // Spec folders are one level deep; the wiki may nest, and only Markdown plus the root reason file are read there.
  async function visit(path: string, depth: number, documents: boolean) {
    const stat = await info(join(root, path)); if (!stat) return;
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) fail(t('store.linkOrSpecial', { path }));
    if (++count > 4000) fail(t('store.tooManyFiles'));
    if (stat.isDirectory()) {
      if (depth > (documents ? 8 : 1)) fail(t('store.tooDeep', { path }));
      for (const name of (await readdir(join(root, path))).sort()) await visit(path + '/' + name, depth + 1, documents);
    } else {
      if (documents ? !(path.endsWith('.md') || (depth === 1 && path.endsWith('/history.jsonl'))) : !/\/(requirements\.md|design\.md|history\.jsonl)$/.test(path)) return;
      if (!recordPathPattern.test(path)) fail(t('store.unsupportedPath', { path }));
      if (stat.nlink !== 1 || stat.size > 1024 * 1024) fail(t('store.hardLinkOrSize'));
      const raw = await readFile(join(root, path)); bytes += raw.length;
      if (raw.length > 1024 * 1024 || bytes > 16 * 1024 * 1024) fail(t('store.sizeLimit'));
      files.set(path, decode(raw));
    }
  }
  await visit('.gitifact/spec', 0, false);
  await visit(WIKI_DIR, 0, true);
  const bundle = parsePreviewBundle(files);
  // Entries are sorted so the stamp does not depend on the order the store folders were visited.
  return { root, files, specs: bundle.specs, wiki: bundle.wiki, bundle, config, stamp: digest(JSON.stringify([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) + (config ?? '')) };
}

export async function readWorkingPreviewState({ root, gitDir }: StoreLocation) {
  if (await info(join(gitDir, 'gitifact-spec-preview.lock'))) fail(t('store.locked'));
  const first = await snapshot(root); const second = await snapshot(root);
  if (first.stamp !== second.stamp) fail(t('store.changedWhileReading'));
  if (await info(join(gitDir, 'gitifact-spec-preview.lock'))) fail(t('store.lockedWhileReading'));
  return first;
}

export async function readWorkingPreview(location: StoreLocation) {
  const { root, stamp, specs, wiki, bundle } = await readWorkingPreviewState(location);
  return { stamp, specs, wiki, warnings: await workingWarnings(root, bundle) };
}

export async function saveWorkingPreview(location: StoreLocation, input: unknown, publish = rename) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(t('store.invalidInput'));
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'expected,operations' || typeof request.expected !== 'string') fail(t('store.expectedOperations'));
  return previewTransaction(location, request.expected as string, async before => {
    const result = editSpecPreview(before.bundle, request.operations, generatePreviewId);
    const writes = new Map<string, string | null>();
    for (const spec of result.specs) {
      const old = before.specs.find(s => s.id === spec.id);
      if (!old || renderSpecPreview(old) !== renderSpecPreview(spec)) writes.set(spec.path, renderSpecPreview(spec));
      if (JSON.stringify(old?.design) !== JSON.stringify(spec.design)) writes.set(spec.path.replace(/requirements\.md$/, 'design.md'), spec.design ? renderDesignPreview(spec.id, spec.design) : null);
    }
    // A moved page leaves its old path and appears at the new one; a deleted one only leaves.
    const previousDocs = before.wiki.documents; const nextDocs = result.wiki.documents;
    for (const doc of nextDocs) {
      const old = previousDocs.find(d => d.id === doc.id);
      if (old && old.path !== doc.path) writes.set(old.path, null);
      if (!old || renderDocument(old) !== renderDocument(doc) || old.path !== doc.path) writes.set(doc.path, renderDocument(doc));
    }
    for (const old of previousDocs) if (!nextDocs.some(d => d.id === old.id)) writes.set(old.path, null);
    return { writes, data: { results: result.results } };
  }, publish);
}

export type WorkingPreviewSnapshot = Awaited<ReturnType<typeof snapshot>>;
// Internal callers must already hold gitifact-spec-preview.lock.
export const readLockedPreviewState = (root: string) => snapshot(root);
export async function previewTransaction<T>({ root, gitDir }: StoreLocation, expected: string, build: (before: WorkingPreviewSnapshot) => Promise<{
  writes: Map<string, string | null>; data: T; recheck?: () => Promise<void>;
}>, publish = rename, afterPublish?: (state: WorkingPreviewSnapshot) => Promise<void>) {
  const lock = join(gitDir, 'gitifact-spec-preview.lock');
  try { await mkdir(lock); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') fail(t('store.locked')); throw e; }
  const createdDirs: string[] = []; const temporary: string[] = [];
  const changed: { path: string; before: string | null; after: string | null }[] = [];
  const published: typeof changed = []; let keepRecovery = false;
  async function directory(path: string) {
    const stat = await info(path);
    if (stat) { if (!stat.isDirectory() || stat.isSymbolicLink()) fail(t('store.notDirectory', { path })); return; }
    await directory(dirname(path)); await mkdir(path); createdDirs.push(path);
  }
  try {
    const before = await snapshot(root);
    if (before.stamp !== expected) fail(t('store.staleExpected'));
    const result = await build(before);
    for (const [path, after] of result.writes) {
      if (!recordPathPattern.test(path) || path.split('/').some(p => p === '..' || p === '.' || /[\\:\0]/.test(p))) fail(t('store.unsupportedSavePath'));
      if (after !== null && Buffer.byteLength(after) > 1024 * 1024) fail(t('store.fileSizeLimit'));
      changed.push({ path, before: before.files.get(path) ?? null, after });
    }
    const finalFiles = new Map(before.files); for (const c of changed) { if (c.after === null) finalFiles.delete(c.path); else finalFiles.set(c.path, c.after); }
    if (finalFiles.size > 2000 || [...finalFiles.values()].reduce((n, s) => n + Buffer.byteLength(s), 0) > 16 * 1024 * 1024) fail(t('store.totalLimit'));
    // Keep original bytes before any publication; abrupt process termination leaves this lock for inspection.
    await writeFile(join(lock, 'recovery.json'), JSON.stringify({ root, changed }), { flag: 'wx' });
    for (const c of changed) {
      if (c.after === null) { temporary.push(''); continue; }
      await directory(dirname(join(root, c.path)));
      const temp = join(dirname(join(root, c.path)), '.gitifact-save-' + randomBytes(12).toString('hex'));
      await writeFile(temp, c.after, { flag: 'wx' }); temporary.push(temp);
    }
    if ((await snapshot(root)).stamp !== before.stamp) fail(t('store.changedPreparing'));
    await result.recheck?.();
    for (let i = 0; i < changed.length; i++) {
      const c = changed[i]!; const path = join(root, c.path); const stat = await info(path);
      if (stat?.isSymbolicLink() || (stat && !stat.isFile()) || (stat ? decode(await readFile(path)) : null) !== c.before) fail(t('store.changedBeforeWrite'));
      if (c.after === null) await unlink(path); else await publish(temporary[i]!, path);
      published.push(c);
    }
    const after = await snapshot(root);
    if (after.stamp !== digest(JSON.stringify([...finalFiles].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) + (before.config ?? ''))) fail(t('store.changedWhileWriting'));
    await result.recheck?.();
    // Runs while the lock is held; a normal failure here restores the published files like any other failure.
    await afterPublish?.(after);
    return { ...result.data, stamp: after.stamp, paths: changed.map(c => c.path), specs: after.specs, wiki: after.wiki, warnings: await workingWarnings(root, after.bundle) };
  } catch (error) {
    if (error instanceof PreservedPreviewError) { keepRecovery = true; throw error; }
    for (const c of [...published].reverse()) {
      try {
        const path = join(root, c.path); const stat = await info(path);
        if (c.after === null ? !!stat : !stat?.isFile() || stat.isSymbolicLink() || decode(await readFile(path)) !== c.after) { keepRecovery = true; continue; }
        if (c.before === null) await unlink(path);
        else {
          const temp = join(dirname(path), '.gitifact-restore-' + randomBytes(12).toString('hex'));
          temporary.push(temp); await writeFile(temp, c.before, { flag: 'wx' }); await rename(temp, path);
        }
      } catch { keepRecovery = true; }
    }
    if (keepRecovery) fail(t('store.recoveryIncomplete', { path: lock }));
    throw error;
  } finally {
    for (const path of temporary.filter(Boolean)) await unlink(path).catch(e => { if (e.code !== 'ENOENT') keepRecovery = true; });
    for (const path of [...createdDirs].reverse()) await rmdir(path).catch(() => {});
    if (!keepRecovery) { await unlink(join(lock, 'recovery.json')).catch(e => { if (e.code !== 'ENOENT') throw e; }); await rmdir(lock); }
  }
}
