import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compareSpecPreviews, finalSpecPreviewChanges, parseSpecPreview, prepareSpecPreview, SpecPreviewError, validatePreviewSnapshot } from '@tryce/core';
import { specPreviewReader } from '../git/spec-preview-reader.js';
import { generatePreviewId, previewTransaction, readWorkingPreviewState } from './spec-preview-store.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const expected = (base: unknown, stamp: string) => createHash('sha256').update(JSON.stringify({ base, stamp })).digest('hex');
const parseFiles = (files: Map<string, string>) => {
  const specs = [...files].filter(([path]) => path.endsWith('/requirements.md')).map(([path, text]) =>
    parseSpecPreview(path, text, files.get(path.replace(/requirements\.md$/, 'history.jsonl')) ?? ''));
  for (const path of files.keys()) if (path.endsWith('/history.jsonl') && !files.has(path.replace(/history\.jsonl$/, 'requirements.md'))) fail('명세 없는 과거 이유 파일입니다.');
  validatePreviewSnapshot(specs); return specs;
};
async function context(cwd: string) {
  const reader = specPreviewReader(cwd); const { gitDir } = await reader.location();
  const checkOperation = async () => {
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      const exists = await lstat(join(gitDir, name)).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
      if (exists) fail('Git 통합 작업 중에는 실험용 커밋 준비를 하지 않습니다.');
    }
  };
  await checkOperation();
  const base = await reader.baseline();
  const working = await readWorkingPreviewState(cwd);
  const files = base.head ? await reader.files(base.head, working.config !== undefined) : new Map<string, string>();
  const specs = parseFiles(files);
  const recheck = async () => { await checkOperation(); if (!same(base, await reader.baseline())) fail('HEAD 또는 브랜치가 변경됐습니다. changes부터 다시 확인하세요.'); };
  return { reader, base, files, specs, recheck };
}

export async function readFinalPreviewChanges(cwd: string) {
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  const delta = finalSpecPreviewChanges(c.specs, current.specs); await c.recheck();
  const pendingReasons = current.specs.flatMap(s => s.history.slice(c.specs.find(p => p.id === s.id)?.history.length ?? 0)
    .map(h => ({ specId: s.id, path: s.path.replace(/requirements\.md$/, 'history.jsonl'), ...h })));
  return { base: c.base, expected: expected(c.base, current.stamp), stamp: current.stamp, pendingReasons, ...delta };
}

export async function prepareWorkingPreview(cwd: string, input: unknown, publish?: Parameters<typeof previewTransaction>[3]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('잘못된 준비 입력입니다.');
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'expected,reasons' || typeof request.expected !== 'string') fail('expected와 reasons가 필요합니다.');
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  if (request.expected !== expected(c.base, current.stamp)) fail('준비 입력이 오래됐습니다. changes부터 다시 확인하세요.');
  const result = await previewTransaction(cwd, current.stamp, async before => {
    await c.recheck();
    const prepared = prepareSpecPreview(c.specs, before.specs, c.files, before.files, request.reasons, () => generatePreviewId('H'));
    return { writes: prepared.writes, data: { changes: prepared.changes, specChanges: prepared.specChanges, reasons: prepared.reasons, withoutReason: prepared.withoutReason }, recheck: c.recheck };
  }, publish);
  return { ...result, base: c.base, expected: expected(c.base, result.stamp), verification: { base: c.base, stamp: result.stamp } };
}

export async function verifyPreparedPreview(cwd: string, input: unknown, staged: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('잘못된 확인 입력입니다.');
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'base,stamp' || typeof request.stamp !== 'string') fail('prepare가 반환한 verification 객체가 필요합니다.');
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  if (!same(request.base, c.base) || request.stamp !== current.stamp) fail('준비 뒤 HEAD 또는 명세가 변경됐습니다. 다시 준비하세요.');
  finalSpecPreviewChanges(c.specs, current.specs); compareSpecPreviews(c.specs, current.specs);
  if (staged) {
    const index = await c.reader.index();
    if (index.size !== current.files.size) fail('staging의 명세 범위가 준비한 원문과 다릅니다.');
    for (const [path, source] of current.files) {
      const oid = index.get(path); const bytes = Buffer.from(source);
      const hash = createHash(oid?.length === 64 ? 'sha256' : 'sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (oid !== hash) fail('staging 원문이 준비한 파일과 다릅니다: ' + path);
    }
    if (!same([...index], [...await c.reader.index()])) fail('확인 중 staging이 변경됐습니다.');
  }
  if ((await readWorkingPreviewState(cwd)).stamp !== current.stamp) fail('확인 중 명세가 변경됐습니다.');
  await c.recheck(); return { verified: true, scope: staged ? 'staged' : 'working', base: c.base, stamp: current.stamp };
}
