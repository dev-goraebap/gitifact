import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { InitError, parseProjectConfig, parseRequirements, specPattern } from '@tryce/core';
import type { RequirementSet } from '@tryce/core';
import { initRepository } from '../git/init-repository.js';
import { configDirectory, fileInfo, readConfigFile } from './config-file.js';
import { digest, guard, publishNoteFile, readNotes, regularDirectory, safeText, withNoteLock } from './note-store.js';

export const blobHash = (document: string, format: 'sha1' | 'sha256') => createHash(format).update(`blob ${Buffer.byteLength(document)}\0`).update(document).digest('hex');
export const requirementPath = (spec: string, contents: ReadonlyMap<string, string>) =>
  contents.has(`specs/${spec}/tryce.json`) ? `specs/${spec}/tryce.json` : `.tryce/spec/${spec}/tryce.json`;
export const isRequirementPath = (path: string) => /^(?:\.tryce\/spec|specs)\/[^/]+\/tryce\.json$/.test(path);
export async function readRequirementSets(root: string) {
  const sets: RequirementSet[] = []; const contents = new Map<string, string>();
  const checkRoot = await configDirectory(root) ? await guard(join(root, '.tryce')) : undefined;
  let bytes = 0;
  for (const base of ['.tryce/spec', 'specs']) {
    const dir = join(root, base);
    if (!await regularDirectory(dir)) continue;
    const check = await guard(dir); const names = (await readdir(dir)).sort();
    if (names.length > 1000) throw new InitError('REQUIREMENT_LIMIT', base + ' 항목 수가 1,000개를 초과합니다.');
    for (const name of names) {
      if (!specPattern.test(name)) continue;
      const parent = join(dir, name); const info = await fileInfo(parent);
      if (info?.isSymbolicLink()) throw new InitError('PATH_CONFLICT', base + '의 링크를 따라가지 않습니다: ' + name);
      if (!info?.isDirectory()) continue;
      const verify = await guard(parent); const path = `${base}/${name}/tryce.json`;
      if (await fileInfo(join(root, path))) {
        const text = await safeText(join(root, path)); let value: unknown;
        try { value = JSON.parse(text); } catch { throw new InitError('INVALID_REQUIREMENTS', '요구사항 JSON을 읽지 못했습니다: ' + path); }
        const set = parseRequirements(value);
        if (set.spec !== name) throw new InitError('INVALID_REQUIREMENTS', 'spec 경로와 내용이 다릅니다.');
        if (sets.some(s => s.spec === name)) throw new InitError('REQUIREMENT_PATH_CONFLICT', '같은 spec이 새 경로와 이전 경로에 함께 있습니다: ' + name);
        bytes += Buffer.byteLength(text); if (bytes > 16 * 1024 * 1024) throw new InitError('REQUIREMENT_LIMIT', '요구사항 전체 크기 한도를 초과했습니다.');
        sets.push(set); contents.set(path, text);
      }
      await verify();
    }
    await check(); if (JSON.stringify(names) !== JSON.stringify((await readdir(dir)).sort())) throw new InitError('INPUT_CHANGED', base + ' 목록이 변경됐습니다.');
  }
  await checkRoot?.();
  return { sets, contents, stamp: digest(JSON.stringify([...contents])) };
}
type WorkflowContext = {
  root: string; repo: ReturnType<typeof initRepository>; first: Awaited<ReturnType<ReturnType<typeof initRepository>['inspect']>>;
  config: ReturnType<typeof parseProjectConfig>; original: string; records: Awaited<ReturnType<typeof readRequirementSets>>; recheck: () => Promise<void>;
};
export async function workflowTransaction<T>(cwd: string, write: boolean, action: (context: WorkflowContext) => Promise<T>, env = process.env) {
  const repo = initRepository(cwd, env); const first = await repo.inspect(); const root = first.state.repository.rootPath;
  async function context() {
    const original = await readConfigFile(root);
    if (!original) throw new InitError('NOT_INITIALIZED', '먼저 프로젝트를 초기화하세요.');
    const config = parseProjectConfig(original);
    await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    const notes = await readNotes(root); const records = await readRequirementSets(root);
    for (const prefix of ['.tryce/notes/', '.tryce/spec/', 'specs/']) {
      const paths = await repo.trackedPaths(root, prefix, first.state.head.commit);
      const missing = prefix !== '.tryce/notes/' ? paths.filter(p => isRequirementPath(p) && !records.contents.has(p)) : paths.filter(p => !notes.paths.includes(p));
      if (missing.length) throw new InitError('RECORD_DELETED', 'HEAD 또는 index의 기록이 작업 폴더에서 삭제됐습니다.');
    }
    for (const set of records.sets) for (const review of set.reviews) for (const item of review.items) {
      if (blobHash(item.document, first.state.repository.objectFormat) !== item.blob) throw new InitError('INVALID_REQUIREMENTS', '보존된 문서의 Git blob 해시가 다릅니다.');
    }
    for (const set of records.sets) {
      for (const text of await repo.recordVersions(root, requirementPath(set.spec, records.contents), first.state.head.commit)) {
        let old: RequirementSet;
        try { old = parseRequirements(JSON.parse(text)); } catch { throw new InitError('INVALID_REQUIREMENTS', 'HEAD 또는 index의 요구사항 기록을 해석하지 못했습니다.'); }
        const prefix = <T>(a: T[], b: T[]) => a.length <= b.length && a.every((v, i) => isDeepStrictEqual(v, b[i]));
        if (old.spec !== set.spec || !prefix(old.reviews, set.reviews) || !prefix(old.decisions, set.decisions)
          || old.requirements.some((r, i) => set.requirements[i]?.id !== r.id || !prefix(r.revisions, set.requirements[i]!.revisions))) {
          throw new InitError('RECORD_HISTORY_CHANGED', 'HEAD 또는 index의 기존 요구사항·확인 원문·결정을 수정하거나 삭제할 수 없습니다.');
        }
      }
    }
    const recheck = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== original
        || (await readRequirementSets(root)).stamp !== records.stamp || (await readNotes(root)).stamp !== notes.stamp) throw new InitError('INPUT_CHANGED', '설정·기록·HEAD·index가 변경됐습니다.');
    };
    return { root, repo, first, config, original, records, recheck };
  }
  const original = await readConfigFile(root);
  if (!original) throw new InitError('NOT_INITIALIZED', '먼저 프로젝트를 초기화하세요.');
  parseProjectConfig(original);
  if (!write && await fileInfo(join(root, '.tryce/.notes.lock'))) throw new InitError('PROJECT_BUSY', '기록 작업 잠금이 있습니다.');
  return write ? withNoteLock(root, async () => action(await context())) : action(await context());
}
export async function saveRequirementSet(root: string, set: RequirementSet, recheck: () => Promise<void>, checkIgnore: (path: string) => Promise<void>, exists: boolean, path: string) {
  parseRequirements(set); const text = JSON.stringify(set, null, 2) + '\n';
  if (Buffer.byteLength(text) > 65536) throw new InitError('REQUIREMENT_LIMIT', 'spec 하나의 기록 한도는 64 KiB입니다.');
  const checks: (() => Promise<void>)[] = [await guard(join(root, '.tryce'))];
  const base = path.startsWith('.tryce/spec/') ? '.tryce/spec' : 'specs';
  if (!await fileInfo(join(root, base, set.spec)) && await regularDirectory(join(root, base)) && (await readdir(join(root, base))).length >= 1000) throw new InitError('REQUIREMENT_LIMIT', '새 spec 디렉터리를 추가할 수 없습니다.');
  for (const part of [base, `${base}/${set.spec}`]) {
    const path = join(root, part); await regularDirectory(path);
    await mkdir(path).catch(e => { if (e.code !== 'EEXIST') throw e; }); checks.push(await guard(path));
  }
  await publishNoteFile(root, path, text, async () => { for (const check of checks) await check(); await recheck(); await checkIgnore(path); }, exists);
  for (const check of checks) await check();
  if (await safeText(join(root, path)) !== text) throw new InitError('INPUT_CHANGED_AFTER_WRITE', '저장 후 기록이 변경됐습니다. 결과를 보존했습니다.');
}
