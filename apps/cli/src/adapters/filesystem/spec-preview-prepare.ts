import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { comparePreviewBundles, finalSpecPreviewChanges, parsePreviewBundle, pendingPreviewReasons, prepareSpecPreview, SpecPreviewError } from '@gitifact/core';
import { specPreviewReader } from '../git/spec-preview-reader.js';
import { generatePreviewId, previewTransaction, readWorkingPreviewState } from './spec-preview-store.js';
import { t } from '../../shared/i18n/index.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const expected = (base: unknown, stamp: string) => createHash('sha256').update(JSON.stringify({ base, stamp })).digest('hex');
export const previewExpected = expected;
export async function readPreviewContext(cwd: string) {
  const reader = specPreviewReader(cwd); const { gitDir } = await reader.location();
  const checkOperation = async () => {
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      const exists = await lstat(join(gitDir, name)).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
      if (exists) fail(t('prepare.integrationInProgress'));
    }
  };
  await checkOperation();
  const base = await reader.baseline();
  const working = await readWorkingPreviewState(cwd);
  const files = base.head ? await reader.files(base.head, working.config !== undefined) : new Map<string, string>();
  const bundle = parsePreviewBundle(files); const specs = bundle.specs;
  const recheck = async () => { await checkOperation(); if (!same(base, await reader.baseline())) fail(t('prepare.headChanged')); };
  return { reader, base, files, specs, bundle, recheck, working };
}
const context = readPreviewContext;

export async function readFinalPreviewChanges(cwd: string) {
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  const delta = finalSpecPreviewChanges(c.bundle, current.bundle); await c.recheck();
  const pendingReasons = pendingPreviewReasons(c.bundle, current.bundle);
  return { base: c.base, expected: expected(c.base, current.stamp), stamp: current.stamp, pendingReasons, ...delta };
}

export async function prepareWorkingPreview(cwd: string, input: unknown, publish?: Parameters<typeof previewTransaction>[3]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(t('prepare.invalidInput'));
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'expected,reasons' || typeof request.expected !== 'string') fail(t('prepare.expectedReasons'));
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  if (request.expected !== expected(c.base, current.stamp)) fail(t('prepare.staleInput'));
  const result = await previewTransaction(cwd, current.stamp, async before => {
    await c.recheck();
    const prepared = prepareSpecPreview(c.bundle, before.bundle, c.files, before.files, request.reasons, () => generatePreviewId('H'));
    return { writes: prepared.writes, data: { changes: prepared.changes, specChanges: prepared.specChanges, reasons: prepared.reasons, withoutReason: prepared.withoutReason }, recheck: c.recheck };
  }, publish);
  return { ...result, base: c.base, expected: expected(c.base, result.stamp), verification: { base: c.base, stamp: result.stamp } };
}

export async function verifyPreparedPreview(cwd: string, input: unknown, staged: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(t('prepare.invalidVerifyInput'));
  const request = input as Record<string, unknown>;
  if (Object.keys(request).sort().join(',') !== 'base,stamp' || typeof request.stamp !== 'string') fail(t('prepare.verificationRequired'));
  const c = await context(cwd); const current = await readWorkingPreviewState(cwd);
  if (!same(request.base, c.base) || request.stamp !== current.stamp) fail(t('prepare.changedAfterPrepare'));
  finalSpecPreviewChanges(c.bundle, current.bundle); comparePreviewBundles(c.bundle, current.bundle);
  if (staged) {
    const index = await c.reader.index();
    if (index.size !== current.files.size) fail(t('prepare.stagingScope'));
    for (const [path, source] of current.files) {
      const oid = index.get(path); const bytes = Buffer.from(source);
      const hash = createHash(oid?.length === 64 ? 'sha256' : 'sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (oid !== hash) fail(t('prepare.stagingContent', { path }));
    }
    if (!same([...index], [...await c.reader.index()])) fail(t('prepare.stagingChanged'));
  }
  if ((await readWorkingPreviewState(cwd)).stamp !== current.stamp) fail(t('prepare.specsChanged'));
  await c.recheck(); return { verified: true, scope: staged ? 'staged' : 'working', base: c.base, stamp: current.stamp };
}
