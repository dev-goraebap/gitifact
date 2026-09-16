import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareSpecPreview, pendingPreviewReasons } from '@gitifact/core';
import { createGitRunner } from '../adapters/git/run-git.js';
import { previewExpected, readPreviewContext } from '../adapters/filesystem/spec-preview-prepare.js';
import { failOnLegacyLock, generatePreviewId, PreservedPreviewError, previewTransaction, readLockedPreviewState } from '../adapters/filesystem/spec-preview-store.js';
import { checkLegacySelection, fail, fingerprint, hash, info, object, optional, paths, policyPaths, record, text } from './spec-commit-files.js';

const fields = ['reasons', 'paths', 'message', 'authorization', 'requirements', 'policyFiles', 'expected'];
const integration = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Records final reasons and commits the selected files in one process.
 * State is read once; rechecks remain where another process could interfere: under the spec lock before
 * staging, before `git commit`, and after it. A rejected commit restores the reason files; a commit whose
 * result cannot be verified keeps every file and the recovery data.
 */
export async function specCommit(cwd: string, input: unknown, dryRun: boolean) {
  const request = object(input);
  if (Object.keys(request).some(k => !fields.includes(k))) fail('알 수 없는 커밋 입력 필드입니다.');
  const selected = paths(request.paths); const authorization = object(request.authorization);
  if (Object.keys(authorization).sort().join(',') !== 'basis,evidence' || !['user-request', 'project-policy'].includes(String(authorization.basis))) fail('사용자 요청 또는 명시적 정책에 따른 커밋 근거가 필요합니다.');
  text(authorization.evidence, 2000);
  const message = text(request.message, 4000); if (/^\s*Gitifact-/im.test(message)) fail('Gitifact 트레일러는 requirements로 지정하세요.');
  const references = request.requirements ?? [];
  if (!Array.isArray(references) || references.length > 1000 || references.some(r => typeof r !== 'string')) fail('잘못된 요구사항 참조입니다.');
  const extra = request.policyFiles === undefined ? [] : paths(request.policyFiles, 1024);
  if (request.expected !== undefined && typeof request.expected !== 'string') fail('expected는 changes가 반환한 문자열이어야 합니다.');

  const c = await readPreviewContext(cwd); const { root, gitDir, indexPath, objectFormat } = await c.reader.location();
  const runner = createGitRunner();
  const git = (args: string[], index?: string, stdin?: Buffer) => runner(['-c', 'core.fsmonitor=false', ...args], { cwd: root,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0',
      GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) },
    timeoutMs: 120000, maxBytes: 32 * 1024 * 1024, ...(stdin ? { input: stdin } : {}) });
  const staged = async (index?: string) => (await git(['diff', '--cached', '--ita-visible-in-index', '--name-only', '--no-renames', '-z'], index)).toString('utf8').split('\0').filter(Boolean).sort();
  const busy = join(gitDir, 'gitifact-spec-commit.lock');
  await failOnLegacyLock(gitDir);
  if (await info(busy)) fail('이전 커밋 작업 또는 복구 자료가 있습니다: ' + busy);
  if ((await staged()).length) fail('기존 staging을 보존합니다. 선택 범위를 정리한 후 다시 실행하세요.');
  const indexHash = hash(await optional(indexPath) ?? Buffer.alloc(0));

  const current = c.working;
  if (request.expected !== undefined && request.expected !== previewExpected(c.base, current.stamp)) fail('입력이 오래됐습니다. changes부터 다시 확인하세요.');
  // Omitted reasons keep the uncommitted reasons already written; an explicit list replaces them.
  const reasons = request.reasons ?? pendingPreviewReasons(c.bundle, current.bundle)
    .map(h => ({ requirements: h.requirements, ...(h.designs ? {designs: h.designs} : {}), ...(h.documents ? {documents: h.documents} : {}), reason: h.reason }));
  const prepared = prepareSpecPreview(c.bundle, current.bundle, c.files, current.files, reasons, () => generatePreviewId('H'));
  // Judge changes by the blob Git would store, so a CRLF checkout of an LF blob (core.autocrlf, eol attributes) is not a change.
  const blobId = (text: string) => { const bytes = Buffer.from(text); return createHash(objectFormat).update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); };
  const present = [...current.files.keys()];
  if (present.some(p => p.includes('\n'))) fail('줄바꿈이 포함된 명세 경로는 지원하지 않습니다.');
  const stored = present.length ? (await git(['hash-object', '--stdin-paths'], undefined, Buffer.from(present.join('\n') + '\n'))).toString('utf8').split('\n') : [''];
  if (stored.length !== present.length + 1) fail('명세 파일의 Git 저장 형태를 확인하지 못했습니다.');
  const workingIds = new Map(present.map((p, i) => [p, stored[i]]));
  // A reason file whose working bytes already store as the prepared content is not rewritten.
  const writes = new Map([...prepared.writes].filter(([p, next]) => next === null || workingIds.get(p) !== blobId(next)));
  const finalId = (p: string) => writes.has(p) ? (writes.get(p) === null ? undefined : blobId(writes.get(p)!)) : workingIds.get(p);
  const pending = [...new Set([...c.files.keys(), ...present, ...writes.keys()])].filter(p => (c.files.has(p) ? blobId(c.files.get(p)!) : undefined) !== finalId(p));
  if (pending.some(p => !selected.includes(p))) fail('변경된 명세와 이유를 함께 선택하세요. 미선택 명세를 자동 포함하지 않습니다.');
  const finalFiles = new Map(current.files);
  for (const [path, next] of writes) { if (next === null) finalFiles.delete(path); else finalFiles.set(path, next); }
  await checkLegacySelection(root, selected);
  // A selected reason file with nothing to record is skipped instead of failing `git add`.
  const stageable = selected.filter(p => !record(p) || finalFiles.has(p) || c.files.has(p));
  const known = new Set([...current.specs.flatMap(s => s.requirements.map(r => r.id)), ...prepared.changes.filter(x => x.kind === 'requirement').map(x => x.id)]);
  if ((references as string[]).some(r => !known.has(r))) fail('실제 요구사항 ID만 참조하세요.');
  const requirements = [...new Set([...references as string[], ...prepared.changes.filter(x => x.kind === 'requirement').map(x => x.id)])].sort();
  const contextPaths = [...new Set([...policyPaths(selected), ...extra])].sort();
  const hashes = async (list: string[]) => new Map(await Promise.all(list.map(async p => [p, await fingerprint(root, p)] as const)));
  // Policies and files read by the agent are bound now; reason files are bound after they are written.
  const started = await hashes([...new Set([...selected.filter(p => !writes.has(p)), ...contextPaths])]);
  const summary = { base: c.base, paths: selected, requirements, changes: prepared.changes, specChanges: prepared.specChanges,
    reasons: prepared.reasons, withoutReason: prepared.withoutReason, historyPaths: [...writes.keys()].sort() };
  if (dryRun) { await c.recheck(); return { outcome: 'dry-run' as const, committed: false, ...summary }; }

  const trailers = [...requirements.map(id => 'Gitifact-Req: ' + id), ...prepared.changes.filter(c => c.kind === 'design').map(c => 'Gitifact-Design: ' + c.id),
    ...prepared.changes.filter(c => c.kind === 'product' || c.kind === 'guide').map(c => 'Gitifact-Doc: ' + c.id)];
  const temporary = join(gitDir, 'gitifact-commit-index-' + randomUUID());
  let owned = false; let uncertain = false; let indexLock: Awaited<ReturnType<typeof open>> | undefined;
  let committed: { commit: string; paths: string[] } | undefined;
  try {
    try { await mkdir(busy); owned = true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') fail('이전 커밋 작업 또는 복구 자료가 있습니다: ' + busy); throw e; }
    // The transaction verifies the stamp, so the reasons prepared above apply to exactly this state.
    await previewTransaction(cwd, current.stamp, async () => ({ writes, data: {}, recheck: c.recheck }), rename, async published => {
      let commitStarted = false;
      try {
        const lock = indexLock = await open(indexPath + '.lock', 'wx', 0o600);
        const original = await optional(indexPath);
        if (hash(original ?? Buffer.alloc(0)) !== indexHash || (await staged()).length) fail('실행 중 index가 변경됐습니다.');
        const locked = await hashes([...new Set([...selected, ...contextPaths])]);
        for (const [path, value] of started) if (locked.get(path) !== value) fail('실행 중 파일·정책이 변경됐습니다: ' + path);
        await writeFile(join(busy, 'recovery.json'), JSON.stringify({ before: c.base, originalIndex: original?.toString('base64') ?? null, temporary, paths: selected, message, requirements }));
        if (original) await writeFile(temporary, original, { flag: 'wx' }); else await git(['read-tree', '--empty'], temporary);
        await git(['add', '--', ...stageable], temporary);
        const actual = await staged(temporary);
        if (!actual.length || actual.some(p => !selected.includes(p))) fail('빈 커밋 또는 선택 밖 파일이 감지됐습니다.');
        const records = selected.filter(p => record(p) && locked.get(p) !== null);
        if (records.length) {
          // One batch reads the staged spec and reason bytes to reject Git filters that change them.
          const output = await git(['cat-file', '--batch'], temporary, Buffer.from(records.map(p => ':' + p).join('\n') + '\n')); let offset = 0;
          for (const path of records) {
            const end = output.indexOf(10, offset); const header = output.subarray(offset, end).toString('utf8').split(' '); const size = Number(header[2]);
            if (end < 0 || header[1] !== 'blob' || !Number.isSafeInteger(size) || output[end + 1 + size] !== 10) fail('staging된 명세·이유를 읽지 못했습니다: ' + path);
            // Line-ending normalization (core.autocrlf, eol attributes) is allowed; any other rewrite by a filter is not.
            const staged = output.subarray(end + 1, end + 1 + size); const file = await readFile(join(root, path));
            if (!staged.equals(file) && !staged.equals(Buffer.from(file.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'))) fail('Git 필터가 명세·이유 원문을 변경했습니다.');
            offset = end + size + 2;
          }
        }
        const again = await hashes([...locked.keys()]);
        for (const [path, value] of locked) if (again.get(path) !== value) fail('커밋 준비 중 파일·정책이 변경됐습니다: ' + path);
        if ((await readLockedPreviewState(root)).stamp !== published.stamp) fail('커밋 준비 중 명세 집합이 변경됐습니다.');
        for (const name of integration) if (await info(join(gitDir, name))) fail('Git 통합 작업이 시작됐습니다.');
        if (!same(c.base, await c.reader.baseline())) fail('HEAD가 변경됐습니다.');
        const tree = (await git(['write-tree'], temporary)).toString('utf8').trim();
        commitStarted = true;
        await git(['commit', '-m', message.trim() + (trailers.length ? '\n\n' + trailers.join('\n') : '')], temporary);
        const after = await c.reader.baseline();
        if (!after.head) return fail('커밋 결과를 확인하지 못했습니다.');
        // The raw object carries tree, parents and message without log formatting or signature display settings.
        const raw = (await git(['cat-file', 'commit', after.head])).toString('utf8'); const split = raw.indexOf('\n\n');
        const headers = raw.slice(0, split < 0 ? raw.length : split).split('\n'); const body = split < 0 ? '' : raw.slice(split + 2);
        const parents = headers.filter(h => h.startsWith('parent ')).map(h => h.slice(7));
        if (headers[0] !== 'tree ' + tree || after.branch !== c.base.branch || !same(parents, c.base.head ? [c.base.head] : [])
          || trailers.some(t => !body.split(/\r?\n/).includes(t))) fail('커밋은 실행됐지만 훅·동시 작업이 결과를 변경했습니다.');
        if (hash(await optional(indexPath) ?? Buffer.alloc(0)) !== indexHash) fail('커밋 후 원래 index 변경을 감지했습니다.');
        if ((await git(['write-tree'], temporary)).toString('utf8').trim() !== tree) fail('훅이 커밋 후 staging을 변경했습니다.');
        // Preserve unrelated index flags while publishing only the verified commit's index.
        await lock.writeFile(await readFile(temporary)); await lock.sync(); await lock.close();
        await rename(indexPath + '.lock', indexPath); indexLock = undefined;
        committed = { commit: after.head, paths: actual };
      } catch (error) {
        if (commitStarted) { try { uncertain = !same(c.base, await c.reader.baseline()); } catch { uncertain = true; } }
        if (uncertain) throw new PreservedPreviewError('Git 실행 결과를 확인해야 합니다. 재시도하지 말고 HEAD와 복구 자료를 확인하세요: ' + busy);
        throw error;
      }
    });
  } finally {
    await indexLock?.close().catch(() => {});
    if (!uncertain) {
      if (indexLock) await unlink(indexPath + '.lock').catch(() => {});
      await unlink(temporary).catch(() => {});
      if (owned) { await unlink(join(busy, 'recovery.json')).catch(() => {}); await rmdir(busy); }
    }
  }
  return { outcome: 'committed' as const, committed: true, ...summary, commit: committed!.commit, paths: committed!.paths, pushed: false };
}
