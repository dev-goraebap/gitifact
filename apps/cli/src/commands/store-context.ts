import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { finalStoreChanges, parseStoreBundle, listPendingReasons, StoreError } from '@gitifact/core';
import { storeReader } from '../adapters/git/store-reader.js';
import { readWorkingState } from '../adapters/filesystem/store.js';
import { t } from '../shared/i18n/index.js';

const fail = (message: string): never => { throw new StoreError(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const expected = (base: unknown, stamp: string) => createHash('sha256').update(JSON.stringify({ base, stamp })).digest('hex');
export const expectedStamp = expected;
export async function readStoreContext(cwd: string) {
  const reader = storeReader(cwd); const location = await reader.location(); const { gitDir } = location;
  const checkOperation = async () => {
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      const exists = await lstat(join(gitDir, name)).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
      if (exists) fail(t('prepare.integrationInProgress'));
    }
  };
  await checkOperation();
  const base = await reader.baseline();
  const working = await readWorkingState(location);
  const files = base.head ? await reader.files(base.head) : new Map<string, string>();
  const bundle = parseStoreBundle(files); const specs = bundle.specs;
  const recheck = async () => { await checkOperation(); if (!same(base, await reader.baseline())) fail(t('prepare.headChanged')); };
  return { reader, location, base, files, specs, bundle, recheck, working };
}
const context = readStoreContext;

export async function readFinalChanges(cwd: string) {
  const c = await context(cwd); const current = await readWorkingState(c.location);
  const delta = finalStoreChanges(c.bundle, current.bundle); await c.recheck();
  const pendingReasons = listPendingReasons(c.bundle, current.bundle);
  return { base: c.base, expected: expected(c.base, current.stamp), stamp: current.stamp, pendingReasons, ...delta };
}
