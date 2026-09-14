import { createHash, randomUUID } from 'node:crypto';
import { readFile, lstat, mkdir, open, rename, unlink, rmdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { SpecPreviewError } from '@tryce/core';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { createGitRunner } from '../adapters/git/run-git.js';
import { readWorkingPreviewState, readLockedPreviewState } from '../adapters/filesystem/spec-preview-store.js';
import { readFinalPreviewChanges, verifyPreparedPreview } from '../adapters/filesystem/spec-preview-prepare.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const optional = (path: string) => readFile(path).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
const info = (path: string) => lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
const record = (path: string) => /^\.tryce\/spec\/[^/]+\/(requirements\.md|history\.jsonl)$/.test(path);
function validPath(path: string) {
  if (typeof path !== 'string' || path.length > 1000 || /[\\:\x00-\x1f\x7f]/.test(path)
    || path.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) fail('저장소 상대 경로의 명세 또는 일반 파일만 선택하세요.');
}
async function fingerprint(root: string, path: string) {
  validPath(path); const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const target = join(root, ...parts.slice(0, i)); const stat = await info(target);
    if (!stat) return null;
    if (stat.isSymbolicLink() || (i < parts.length ? !stat.isDirectory() : !stat.isFile())) fail('링크·디렉터리·특수 파일은 선택할 수 없습니다.');
    if (i < parts.length && await info(join(target, '.git'))) fail('중첩 저장소는 선택할 수 없습니다.');
    if (i === parts.length) {
      if (stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) fail('하드 링크 또는 파일 크기 한도를 확인하세요.');
      return hash(Buffer.concat([Buffer.from(String(stat.mode & 0o111) + '\0'), await readFile(target)]));
    }
  }
  return null;
}
type Entry = { path: string; hash: string | null };
type Plan = { kind: 'spec-preview-commit'; root: string; verification: unknown; index: string;
  files: Entry[]; context: Entry[]; message: string; requirements: string[]; authorization: { basis: string; evidence: string }; digest: string };
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('잘못된 커밋 입력입니다.');
  return input as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) return fail('빈 문자열 또는 입력 한도 초과입니다.');
  return value;
}
function paths(value: unknown, limit = 128): string[] {
  if (!Array.isArray(value) || !value.length || value.length > limit || value.some(p => typeof p !== 'string')) return fail('파일 목록 개수 또는 형식이 잘못됐습니다.');
  const list = [...new Set(value as string[])].sort(); list.forEach(validPath); return list;
}
const seal = (p: Omit<Plan, 'digest'>) => hash(JSON.stringify(p));
function policyPaths(files: string[]) {
  const all = new Set(['AGENTS.md', 'CLAUDE.md', '.agents/skills/tryce-workflow/SKILL.md', '.gitignore', '.gitattributes', '.tryce/config.json']);
  for (const file of files) { const parts = file.split('/'); for (let i = 1; i < parts.length; i++) for (const name of ['AGENTS.md', 'CLAUDE.md', '.gitignore', '.gitattributes']) all.add(parts.slice(0, i).join('/') + '/' + name); }
  return [...all].sort();
}

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
  const busy = join(gitDir, 'tryce-spec-commit.lock');
  if (await info(busy)) fail('이전 커밋 작업 또는 복구 자료가 있습니다: ' + busy);
  if ((await staged()).length) fail('기존 staging을 보존합니다. 선택 범위를 정리한 후 다시 계획하세요.');
  const request = object(input); let plan: Plan;
  if (action === 'plan') {
    if (Object.keys(request).some(k => !['verification', 'paths', 'message', 'requirements', 'authorization', 'policyFiles'].includes(k))) fail('알 수 없는 커밋 입력 필드입니다.');
    await verifyPreparedPreview(cwd, request.verification, false);
    const selected = paths(request.paths); const authorization = object(request.authorization);
    for (const p of selected.filter(p => p.startsWith('.tryce/') && !record(p) && p !== '.tryce/config.json')) {
      if (!/^\.tryce\/(?:spec\/[^/]+\/tryce\.json|notes\/N-[a-f0-9-]+\.json|mode-[a-f0-9-]+\.json|config\.(?:init-1|prototype-1)\.[a-f0-9]+\.json)$/.test(p) || await fingerprint(root, p) !== null) fail('.tryce의 구형 기록은 전환 시 삭제만 선택할 수 있습니다.');
    }
    if (Object.keys(authorization).sort().join(',') !== 'basis,evidence' || !['user-request', 'project-policy'].includes(String(authorization.basis))) fail('사용자 요청 또는 명시적 정책에 따른 커밋 근거가 필요합니다.');
    const message = text(request.message, 4000); if (/^\s*Tryce-/im.test(message)) fail('Tryce 트레일러는 requirements로 지정하세요.');
    const state = await readWorkingPreviewState(cwd); const base = await reader.baseline(); const previous = base.head ? await reader.files(base.head, state.config !== undefined) : new Map<string, string>();
    const pending = [...new Set([...previous.keys(), ...state.files.keys()])].filter(p => previous.get(p) !== state.files.get(p));
    if (pending.some(p => !selected.includes(p))) fail('변경된 명세와 이유를 함께 선택하세요. 미선택 명세를 자동 포함하지 않습니다.');
    const delta = await readFinalPreviewChanges(cwd);
    const references = request.requirements ?? [];
    if (!Array.isArray(references) || references.length > 1000 || references.some(r => typeof r !== 'string')) fail('잘못된 요구사항 참조입니다.');
    const known = new Set([...state.specs.flatMap(s => s.requirements.map(r => r.id)), ...delta.changes.map(c => c.id)]);
    if ((references as string[]).some(r => !known.has(r))) fail('실제 요구사항 ID만 참조하세요.');
    const extra = request.policyFiles === undefined ? [] : paths(request.policyFiles, 1024);
    const contents = async (list: string[]) => Promise.all(list.map(async path => ({ path, hash: await fingerprint(root, path) })));
    const data = { kind: 'spec-preview-commit' as const, root, verification: request.verification,
      index: hash(await optional(indexPath) ?? Buffer.alloc(0)), files: await contents(selected), context: await contents([...new Set([...policyPaths(selected), ...extra])].sort()),
      message, requirements: [...new Set([...references as string[], ...delta.changes.map(c => c.id)])].sort(),
      authorization: { basis: String(authorization.basis), evidence: text(authorization.evidence, 2000) } };
    await verifyPreparedPreview(cwd, request.verification, false);
    if (data.index !== hash(await optional(indexPath) ?? Buffer.alloc(0)) || (await staged()).length) fail('계획 중 index가 변경됐습니다.');
    return { outcome: 'planned', plan: { ...data, digest: seal(data) }, committed: false };
  }
  const { digest, ...data } = request;
  if (request.kind !== 'spec-preview-commit' || typeof digest !== 'string' || digest !== seal(data as Omit<Plan, 'digest'>)) fail('커밋 계획이 손상됐습니다. 다시 계획하세요.');
  plan = request as unknown as Plan;
  if (plan.root !== root || !Array.isArray(plan.files) || !Array.isArray(plan.context)) fail('계획의 저장소 또는 파일 범위가 다릅니다.');
  const selected = paths(plan.files.map(f => f.path));
  // Rebuild from current inputs to validate all fields, references, policies and file hashes.
  const refreshed = await previewCommit(cwd, 'plan', { verification: plan.verification, paths: selected, message: plan.message,
    requirements: plan.requirements, authorization: plan.authorization, policyFiles: plan.context.map(f => f.path) });
  if (!('plan' in refreshed) || refreshed.plan.digest !== plan.digest) fail('계획 이후 파일·정책·index가 변경됐습니다. 다시 계획하세요.');
  const before = await reader.baseline(); const original = await optional(indexPath);
  await mkdir(busy); const draftLock = join(gitDir, 'tryce-spec-preview.lock');
  let draftOwned = false; let indexLock: Awaited<ReturnType<typeof open>> | undefined;
  let uncertain = false; let commitStarted = false; const temporary = join(gitDir, 'tryce-commit-index-' + randomUUID());
  const checkFiles = async () => {
    for (const f of [...plan.files, ...plan.context]) if (f.hash !== await fingerprint(root, f.path)) fail('커밋 준비 중 파일·정책이 변경됐습니다: ' + f.path);
    if ((await readLockedPreviewState(root)).stamp !== object(plan.verification).stamp) fail('커밋 준비 중 명세 집합이 변경됐습니다.');
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) if (await info(join(gitDir, name))) fail('Git 통합 작업이 시작됐습니다.');
  };
  try {
    await verifyPreparedPreview(cwd, plan.verification, false);
    await mkdir(draftLock); draftOwned = true;
    indexLock = await open(indexPath + '.lock', 'wx', 0o600);
    if (plan.index !== hash(await optional(indexPath) ?? Buffer.alloc(0)) || (await staged()).length) fail('잠금 중 index가 변경됐습니다.');
    await writeFile(join(busy, 'recovery.json'), JSON.stringify({ before, originalIndex: original?.toString('base64') ?? null, temporary, plan }));
    if (original) await writeFile(temporary, original, { flag: 'wx' }); else await git(['read-tree', '--empty'], temporary);
    await git(['add', '--', ...selected], temporary);
    const actual = await staged(temporary);
    if (!actual.length || actual.some(p => !selected.includes(p))) fail('빈 커밋 또는 선택 밖 파일이 감지됐습니다.');
    for (const file of plan.files.filter(f => record(f.path) && f.hash !== null)) {
      const stagedBytes = await git(['show', ':' + file.path], temporary);
      if (!stagedBytes.equals(await readFile(join(root, file.path)))) fail('Git 필터가 명세·이유 원문을 변경했습니다.');
    }
    await checkFiles(); if (JSON.stringify(before) !== JSON.stringify(await reader.baseline())) fail('HEAD가 변경됐습니다.');
    const tree = (await git(['write-tree'], temporary)).toString('utf8').trim();
    const trailers = plan.requirements.map(id => 'Tryce-Req: ' + id);
    commitStarted = true;
    await git(['commit', '-m', plan.message.trim() + (trailers.length ? '\n\n' + trailers.join('\n') : '')], temporary);
    const after = await reader.baseline();
    const actualTree = (await git(['rev-parse', 'HEAD^{tree}'])).toString('utf8').trim();
    const parents = (await git(['rev-list', '--parents', '-n', '1', 'HEAD'])).toString('utf8').trim().split(' ').slice(1);
    const message = (await git(['log', '-1', '--format=%B'])).toString('utf8');
    if (actualTree !== tree || after.branch !== before.branch || JSON.stringify(parents) !== JSON.stringify(before.head ? [before.head] : [])
      || trailers.some(t => !message.split(/\r?\n/).includes(t))) fail('커밋은 실행됐지만 훅·동시 작업이 결과를 변경했습니다.');
    if (hash(await optional(indexPath) ?? Buffer.alloc(0)) !== plan.index) fail('커밋 후 원래 index 변경을 감지했습니다.');
    if ((await git(['write-tree'], temporary)).toString('utf8').trim() !== tree) fail('훅이 커밋 후 staging을 변경했습니다.');
    // Preserve unrelated index flags while publishing only the verified commit's index.
    await indexLock.writeFile(await readFile(temporary)); await indexLock.sync(); await indexLock.close();
    await rename(indexPath + '.lock', indexPath); indexLock = undefined;
    return { outcome: 'committed', commit: after.head, paths: actual, requirements: plan.requirements, pushed: false };
  } catch (error) {
    if (commitStarted) { try { uncertain = JSON.stringify(before) !== JSON.stringify(await reader.baseline()); } catch { uncertain = true; } }
    if (uncertain) fail('Git 실행 결과를 확인해야 합니다. 재시도하지 말고 HEAD와 복구 자료를 확인하세요: ' + busy);
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
