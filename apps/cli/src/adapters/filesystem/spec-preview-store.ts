import { lstat, readdir, readFile, mkdir, writeFile, rename, unlink, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { editSpecPreview, parsePreviewFiles, renderDesignPreview, designReferenceWarnings, renderSpecPreview, SpecPreviewError, parseManagedConfig } from '@tryce/core';
import { specPreviewReader } from '../git/spec-preview-reader.js';
import { readConfigFile } from './config-file.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const info = async (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
export const generatePreviewId = (prefix: 'S' | 'R' | 'H') => prefix + '-' + [...randomBytes(10)].map(n => 'abcdefghijklmnopqrstuvwxyz234567'[n & 31]).join('');
/** A failure after Git may have changed HEAD: keep written files and recovery data instead of rolling back. */
export class PreservedPreviewError extends SpecPreviewError {}

async function snapshot(root: string) {
  const files = new Map<string, string>(); let count = 0; let bytes = 0;
  const parent = await info(join(root, '.tryce'));
  if (parent && (!parent.isDirectory() || parent.isSymbolicLink())) fail('.tryce는 일반 디렉터리여야 합니다.');
  const config = await readConfigFile(root);
  if ((config !== undefined && !('schemaVersion' in parseManagedConfig(config))) || await info(join(root, 'specs'))) fail('기존 프로젝트 형식은 별도 전환이 필요합니다.');
  async function visit(path: string, depth: number) {
    const stat = await info(join(root, path)); if (!stat) return;
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) fail('링크·특수 파일은 지원하지 않습니다: ' + path);
    if (++count > 4000) fail('명세 파일 수 한도를 초과했습니다.');
    if (stat.isDirectory()) {
      if (depth > 1) fail('중첩 명세 폴더는 지원하지 않습니다: ' + path);
      for (const name of (await readdir(join(root, path))).sort()) await visit(path + '/' + name, depth + 1);
    } else {
      if (path.endsWith('/tryce.json')) fail('기존 JSON 형식은 전환하지 않습니다.');
      if (!/\/(requirements\.md|design\.md|history\.jsonl)$/.test(path)) return;
      if (!/^\.tryce\/spec\/[^/]+\/(requirements\.md|design\.md|history\.jsonl)$/.test(path)) fail('지원하지 않는 명세 경로입니다.');
      if (stat.nlink !== 1 || stat.size > 1024 * 1024) fail('하드 링크 또는 1 MiB 한도를 확인하세요.');
      const raw = await readFile(join(root, path)); bytes += raw.length;
      if (raw.length > 1024 * 1024 || bytes > 16 * 1024 * 1024) fail('명세 크기 한도를 초과했습니다.');
      files.set(path, decode(raw));
    }
  }
  await visit('.tryce/spec', 0);
  const specs = parsePreviewFiles(files);
  return { files, specs, config, stamp: digest(JSON.stringify([...files]) + (config ?? '')) };
}

export async function readWorkingPreviewState(cwd: string) {
  const { root, gitDir } = await specPreviewReader(cwd).location();
  if (await info(join(gitDir, 'tryce-spec-preview.lock'))) fail('명세 저장 잠금 또는 복구 자료가 있습니다.');
  const first = await snapshot(root); const second = await snapshot(root);
  if (first.stamp !== second.stamp) fail('조회 중 명세가 변경됐습니다. 다시 읽으세요.');
  if (await info(join(gitDir, 'tryce-spec-preview.lock'))) fail('조회 중 저장 잠금이 생겼습니다.');
  return first;
}

export async function readWorkingPreview(cwd: string) {
  const { stamp, specs } = await readWorkingPreviewState(cwd); return { stamp, specs, warnings: designReferenceWarnings(specs) };
}

export async function saveWorkingPreview(cwd: string, input: unknown, publish = rename) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('저장 입력이 잘못됐습니다.');
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'expected,operations' || typeof request.expected !== 'string') fail('expected와 operations가 필요합니다.');
  return previewTransaction(cwd, request.expected as string, async before => {
    const result = editSpecPreview(before.specs, request.operations, generatePreviewId);
    const writes = new Map<string, string | null>();
    for (const spec of result.specs) {
      const old = before.specs.find(s => s.id === spec.id);
      if (!old || renderSpecPreview(old) !== renderSpecPreview(spec)) writes.set(spec.path, renderSpecPreview(spec));
      if (JSON.stringify(old?.design) !== JSON.stringify(spec.design)) writes.set(spec.path.replace(/requirements\.md$/, 'design.md'), spec.design ? renderDesignPreview(spec.id, spec.design) : null);
    }
    return { writes, data: { results: result.results } };
  }, publish);
}

export type WorkingPreviewSnapshot = Awaited<ReturnType<typeof snapshot>>;
// Internal callers must already hold tryce-spec-preview.lock.
export const readLockedPreviewState = (root: string) => snapshot(root);
export async function previewTransaction<T>(cwd: string, expected: string, build: (before: WorkingPreviewSnapshot) => Promise<{
  writes: Map<string, string | null>; data: T; recheck?: () => Promise<void>;
}>, publish = rename, afterPublish?: (state: WorkingPreviewSnapshot) => Promise<void>) {
  const { root, gitDir } = await specPreviewReader(cwd).location();
  const lock = join(gitDir, 'tryce-spec-preview.lock');
  try { await mkdir(lock); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') fail('명세 저장 잠금 또는 복구 자료가 있습니다.'); throw e; }
  const createdDirs: string[] = []; const temporary: string[] = [];
  const changed: { path: string; before: string | null; after: string | null }[] = [];
  const published: typeof changed = []; let keepRecovery = false;
  async function directory(path: string) {
    const stat = await info(path);
    if (stat) { if (!stat.isDirectory() || stat.isSymbolicLink()) fail('일반 디렉터리가 아닙니다: ' + path); return; }
    await directory(dirname(path)); await mkdir(path); createdDirs.push(path);
  }
  try {
    const before = await snapshot(root);
    if (before.stamp !== expected) fail('읽은 뒤 명세가 변경됐습니다. working으로 다시 읽으세요.');
    const result = await build(before);
    for (const [path, after] of result.writes) {
      if (!/^\.tryce\/spec\/[^/]+\/(requirements\.md|design\.md|history\.jsonl)$/.test(path) || path.split('/').some(p => p === '..' || p === '.' || /[\\:\0]/.test(p))) fail('지원하지 않는 저장 경로입니다.');
      if (after !== null && Buffer.byteLength(after) > 1024 * 1024) fail('명세 1 MiB 한도를 초과했습니다.');
      changed.push({ path, before: before.files.get(path) ?? null, after });
    }
    const finalFiles = new Map(before.files); for (const c of changed) { if (c.after === null) finalFiles.delete(c.path); else finalFiles.set(c.path, c.after); }
    if (finalFiles.size > 2000 || [...finalFiles.values()].reduce((n, s) => n + Buffer.byteLength(s), 0) > 16 * 1024 * 1024) fail('명세 전체 한도를 초과했습니다.');
    // Keep original bytes before any publication; abrupt process termination leaves this lock for inspection.
    await writeFile(join(lock, 'recovery.json'), JSON.stringify({ root, changed }), { flag: 'wx' });
    for (const c of changed) {
      if (c.after === null) { temporary.push(''); continue; }
      await directory(dirname(join(root, c.path)));
      const temp = join(dirname(join(root, c.path)), '.tryce-save-' + randomBytes(12).toString('hex'));
      await writeFile(temp, c.after, { flag: 'wx' }); temporary.push(temp);
    }
    if ((await snapshot(root)).stamp !== before.stamp) fail('저장 준비 중 명세가 변경됐습니다.');
    await result.recheck?.();
    for (let i = 0; i < changed.length; i++) {
      const c = changed[i]!; const path = join(root, c.path); const stat = await info(path);
      if (stat?.isSymbolicLink() || (stat && !stat.isFile()) || (stat ? decode(await readFile(path)) : null) !== c.before) fail('저장 직전 파일이 변경됐습니다.');
      if (c.after === null) await unlink(path); else await publish(temporary[i]!, path);
      published.push(c);
    }
    const after = await snapshot(root);
    if (after.stamp !== digest(JSON.stringify([...finalFiles].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) + (before.config ?? ''))) fail('저장 중 명세 또는 설정이 변경됐습니다.');
    await result.recheck?.();
    // Runs while the lock is held; a normal failure here restores the published files like any other failure.
    await afterPublish?.(after);
    return { ...result.data, stamp: after.stamp, paths: changed.map(c => c.path), specs: after.specs, warnings: designReferenceWarnings(after.specs) };
  } catch (error) {
    if (error instanceof PreservedPreviewError) { keepRecovery = true; throw error; }
    for (const c of [...published].reverse()) {
      try {
        const path = join(root, c.path); const stat = await info(path);
        if (c.after === null ? !!stat : !stat?.isFile() || stat.isSymbolicLink() || decode(await readFile(path)) !== c.after) { keepRecovery = true; continue; }
        if (c.before === null) await unlink(path);
        else {
          const temp = join(dirname(path), '.tryce-restore-' + randomBytes(12).toString('hex'));
          temporary.push(temp); await writeFile(temp, c.before, { flag: 'wx' }); await rename(temp, path);
        }
      } catch { keepRecovery = true; }
    }
    if (keepRecovery) fail('자동 복구를 완료하지 못했습니다. 다른 편집을 보존했습니다. 복구 자료: ' + lock);
    throw error;
  } finally {
    for (const path of temporary.filter(Boolean)) await unlink(path).catch(e => { if (e.code !== 'ENOENT') keepRecovery = true; });
    for (const path of [...createdDirs].reverse()) await rmdir(path).catch(() => {});
    if (!keepRecovery) { await unlink(join(lock, 'recovery.json')).catch(e => { if (e.code !== 'ENOENT') throw e; }); await rmdir(lock); }
  }
}
