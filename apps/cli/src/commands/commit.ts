import { createHash, randomUUID } from 'node:crypto';
import { readFile, open, rename, unlink, lstat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { InitError, validText, requirementIdPattern, requirementViews } from '@tryce/core';
import { workflowTransaction } from '../adapters/filesystem/workflow-store.js';
import { createGitRunner } from '../adapters/git/run-git.js';
import { createRepositoryReader } from '../adapters/git/repository-reader.js';
import { safeText } from '../adapters/filesystem/note-store.js';
import { fileInfo } from '../adapters/filesystem/config-file.js';

const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
interface Plan { kind: 'tryce-commit-plan'; version: 1; root: string; stamp: string; message: string;
  policy: 'no-policy' | 'permitted'; evidence: string; requirements: string[]; implementation: boolean;
  files: { path: string; hash: string | null }[]; context: { path: string; hash: string | null }[] }
function parsePlan(value: unknown): Plan {
  const p = value as Plan;
  if (!p || p.kind !== 'tryce-commit-plan' || p.version !== 1 || !validText(p.root, 4000) || !validText(p.stamp, 16000)
    || !validText(p.message, 4000) || !['no-policy', 'permitted'].includes(p.policy) || !validText(p.evidence, 2000)
    || !Array.isArray(p.requirements) || p.requirements.length > 1000 || p.requirements.some(id => typeof id !== 'string' || !requirementIdPattern.test(id)) || typeof p.implementation !== 'boolean'
    || !Array.isArray(p.files) || !p.files.length || p.files.length > 128
    || p.files.some(f => !f || !validText(f.path, 1000) || (f.hash !== null && !/^[a-f0-9]{64}$/.test(f.hash)))
    || new Set(p.files.map(f => f.path)).size !== p.files.length || !Array.isArray(p.context) || p.context.length > 1000
    || p.context.some(f => !f || !validText(f.path, 1000) || (f.hash !== null && !/^[a-f0-9]{64}$/.test(f.hash)))) throw new InitError('INVALID_COMMIT_PLAN', '커밋 계획 형식이 올바르지 않습니다.');
  return p;
}
async function fingerprint(root: string, path: string) {
  if (path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')
    || path.startsWith('.tryce/.')) throw new InitError('INVALID_COMMIT_PATH', '일반 파일의 저장소 상대 경로만 지정하세요.');
  const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const item = join(root, ...parts.slice(0, i)); const info = await fileInfo(item);
    if (!info) return null;
    if (info.isSymbolicLink() || (i < parts.length ? !info.isDirectory() : !info.isFile())) throw new InitError('INVALID_COMMIT_PATH', '링크·디렉터리·서브모듈은 자동 커밋하지 않습니다.');
    if (i < parts.length && await fileInfo(join(item, '.git'))) throw new InitError('INVALID_COMMIT_PATH', '중첩 저장소는 자동 커밋하지 않습니다.');
    if (i === parts.length && info.size > 16 * 1024 * 1024) throw new InitError('COMMIT_LIMIT', '자동 커밋 파일은 각각 16 MiB 이하여야 합니다.');
  }
  return hash(await readFile(join(root, path)));
}
export async function commitCommand(cwd: string, action: 'plan' | 'apply', options: { path?: string[]; req?: string[]; implement?: boolean; policyFile?: string[]; message?: string; policy?: string; evidence?: string; file?: string }, env = process.env, beforeApply?: () => Promise<void>) {
  return workflowTransaction(cwd, action === 'apply', async c => {
    if (c.config.format !== 'workflow-1') throw new InitError('WORKFLOW_REQUIRED', 'workflow-1 프로젝트에서 사용하세요.');
    const runner = createGitRunner();
    const git = (args: string[], index?: string, input?: Buffer) => runner(args, { cwd: c.root,
      env: { ...env, GIT_LITERAL_PATHSPECS: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', ...(index ? { GIT_INDEX_FILE: index } : {}) },
      timeoutMs: 120000, maxBytes: 16 * 1024 * 1024, ...(input ? { input } : {}) });
    const staged = async (index?: string) => (await git(['diff', '--cached', '--name-only', '--no-renames', '-z'], index)).toString('utf8').split('\0').filter(Boolean).sort();
    const contextPaths = (paths: string[]) => {
      const names = new Set(['.tryce/config.json', 'AGENTS.md', 'CLAUDE.md', '.agents/skills/tryce-workflow/SKILL.md']);
      for (const path of paths) { const parts = path.split('/'); for (let i = 1; i < parts.length; i++) for (const name of ['AGENTS.md', 'CLAUDE.md']) names.add(parts.slice(0, i).join('/') + '/' + name); }
      return [...names].sort();
    };
    const dependencies = async (paths: string[]) => {
      const changes = (await git(['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', '.tryce/', 'specs/'])).toString('utf8').split('\0').filter(Boolean).map(line => line.slice(3));
      const records = changes.filter(p => p === '.tryce/config.json' || p.startsWith('.tryce/notes/') || /^specs\/[^/]+\/tryce\.json$/.test(p) || /^\.tryce\/(config\.|mode-)/.test(p));
      if (records.some(p => !paths.includes(p))) throw new InitError('UNCOMMITTED_RECORD_DEPENDENCY', '미커밋 기록이 계획에서 빠졌습니다. 관련성을 확인해 기록 단위를 먼저 정리하세요.');
    };
    const validateReferences = (plan: Plan) => {
      if (/^\s*Tryce-/im.test(plan.message)) throw new InitError('RESERVED_TRAILER', 'Tryce 트레일러는 구조화된 계획에서 생성합니다.');
      const views = c.records.sets.flatMap(requirementViews);
      if (plan.implementation && !plan.requirements.length) throw new InitError('REQUIREMENT_REFERENCE_REQUIRED', '구현 선언에는 실제 요구사항 참조가 필요합니다.');
      for (const id of plan.requirements) {
        const view = views.find(v => v.id === id);
        if (!view || (plan.implementation && view.state !== 'active')) throw new InitError('INVALID_REQUIREMENT_REFERENCE', '존재하는 요구사항을 참조하고 구현은 확정된 범위에서 진행하세요: ' + id);
      }
    };
    if ((await staged()).length) throw new InitError('STAGED_CHANGES_EXIST', '이미 staging된 변경을 보존합니다. 자동 커밋을 보류하세요.');
    let plan: Plan;
    if (action === 'plan') {
      if (!['no-policy', 'permitted'].includes(options.policy ?? '')) throw new InitError('COMMIT_POLICY_REQUIRED', '정책이 없거나 현재 작업의 커밋 권한이 확인된 경우에만 계획하세요.');
      const paths = [...new Set(options.path ?? [])].sort();
      await dependencies(paths);
      plan = parsePlan({ kind: 'tryce-commit-plan', version: 1, root: c.root, stamp: c.first.stamp,
        message: options.message, policy: options.policy, evidence: options.evidence,
        requirements: [...new Set([...(options.req ?? []), ...(options.implement ? [] : c.records.sets.filter(s => paths.includes(`specs/${s.spec}/tryce.json`)).flatMap(s => s.requirements.map(r => r.id)))])].sort(), implementation: !!options.implement,
        files: await Promise.all(paths.map(async path => ({ path, hash: await fingerprint(c.root, path) }))),
        context: await Promise.all([...new Set([...contextPaths(paths), ...(options.policyFile ?? [])])].sort().map(async path => ({ path, hash: await fingerprint(c.root, path) }))) });
      for (const f of plan.files) await c.repo.checkIgnore(c.root, f.path);
      validateReferences(plan);
      if (Buffer.byteLength(JSON.stringify(plan)) > 65536) throw new InitError('COMMIT_LIMIT', '계획 파일 한도는 64 KiB입니다. 작업 단위를 줄이세요.');
      await c.recheck(); return { outcome: 'planned', plan, git: 'not-committed' };
    }
    if (!options.file) throw new InitError('COMMIT_PLAN_REQUIRED', '--file로 plan 객체가 담긴 UTF-8 JSON을 지정하세요.');
    let value: unknown; try { value = JSON.parse(await safeText(options.file)); } catch { throw new InitError('INVALID_COMMIT_PLAN', '커밋 계획 파일을 읽지 못했습니다.'); }
    plan = parsePlan(value);
    validateReferences(plan);
    if (contextPaths(plan.files.map(f => f.path)).some(path => !plan.context.some(f => f.path === path))) throw new InitError('INVALID_COMMIT_PLAN', '계획에 지침·설정 검증 대상이 없습니다.');
    if (plan.root !== c.root || plan.stamp !== c.first.stamp) throw new InitError('STALE_COMMIT_PLAN', '계획 이후 저장소·HEAD·index가 변경됐습니다.');
    const verifyFiles = async () => { for (const f of [...plan.files, ...plan.context]) if (await fingerprint(c.root, f.path) !== f.hash) throw new InitError('STALE_COMMIT_PLAN', '계획 이후 파일·지침 내용이 변경됐습니다: ' + f.path); };
    await verifyFiles(); for (const f of plan.files) await c.repo.checkIgnore(c.root, f.path);
    await beforeApply?.(); await c.recheck(); await verifyFiles(); await dependencies(plan.files.map(f => f.path));
    const index = (await git(['rev-parse', '--path-format=absolute', '--git-path', 'index'])).toString('utf8').trim();
    const original = await readFile(index).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    const lockPath = index + '.lock'; const temporary = join(dirname(index), 'tryce-index-' + randomUUID());
    const lock = await open(lockPath, 'wx', 0o600).catch(() => { throw new InitError('PROJECT_BUSY', '다른 Git 작업이 index를 사용하고 있습니다.'); });
    const owned = await lock.stat(); let published = false; let commitStarted = false;
    try {
      const current = await readFile(index).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (hash(current ?? Buffer.alloc(0)) !== hash(original ?? Buffer.alloc(0)) || (await staged()).length) throw new InitError('STALE_COMMIT_PLAN', '잠금 획득 중 index가 변경됐습니다.');
      const lockedState = await createRepositoryReader(c.root, { env }).read();
      if (!isDeepStrictEqual(lockedState.head, c.first.state.head) || !isDeepStrictEqual(lockedState.repository, c.first.state.repository)) throw new InitError('STALE_COMMIT_PLAN', '잠금 획득 중 HEAD 또는 저장소가 변경됐습니다.');
      if (original) { const target = await open(temporary, 'wx', 0o600); try { await target.writeFile(original); } finally { await target.close(); } }
      else await git(['read-tree', '--empty'], temporary);
      await git(['add', '--', ...plan.files.map(f => f.path)], temporary);
      const actual = await staged(temporary);
      if (!actual.length || actual.some(p => !plan.files.some(f => f.path === p))) throw new InitError('COMMIT_SCOPE_CHANGED', '계획 밖의 staged 변경 또는 빈 커밋입니다.');
      for (const f of plan.files.filter(f => f.hash !== null && (/^\.tryce\/.*\.json$/.test(f.path) || /^specs\/[^/]+\/tryce\.json$/.test(f.path)))) {
        try {
          const stagedRecord = JSON.parse((await git(['show', ':' + f.path], temporary)).toString('utf8'));
          if (!isDeepStrictEqual(stagedRecord, JSON.parse(await safeText(join(c.root, f.path))))) throw new Error('filter changed record');
        } catch { throw new InitError('STAGED_RECORD_CHANGED', 'Git 필터가 기록 내용을 변경했거나 기록을 읽지 못했습니다. 원래 index를 보존합니다.'); }
      }
      await verifyFiles();
      const tree = (await git(['write-tree'], temporary)).toString('utf8').trim();
      // Git runs the repository's hooks and signing configuration with this isolated index.
      commitStarted = true;
      const trailers = ['Tryce-Format: workflow-1', ...plan.requirements.map(id => 'Tryce-Req: ' + id),
        ...[...new Set(plan.requirements.map(id => requirementIdPattern.exec(id)![1]))].sort().map(spec => 'Tryce-Spec: ' + spec),
        ...(plan.implementation ? ['Tryce-Change: implement'] : [])];
      await git(['commit', '-m', plan.message.trim() + '\n\n' + trailers.join('\n')], temporary);
      const commit = (await git(['rev-parse', 'HEAD'])).toString('utf8').trim();
      const committedTree = (await git(['rev-parse', 'HEAD^{tree}'])).toString('utf8').trim();
      const parents = (await git(['rev-list', '--parents', '-n', '1', 'HEAD'])).toString('utf8').trim().split(' ').slice(1);
      const expectedParent = c.first.state.head.commit;
      const message = (await git(['log', '-1', '--format=%B'])).toString('utf8');
      const actualTrailers = message.trimEnd().split(/\r?\n\r?\n/).at(-1)?.split(/\r?\n/).filter(line => /^Tryce-/i.test(line)).sort();
      const currentIndex = await readFile(index).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (hash(currentIndex ?? Buffer.alloc(0)) !== hash(original ?? Buffer.alloc(0))) throw new InitError('INDEX_CHANGED_AFTER_COMMIT', '커밋 후 원래 index 변경이 감지됐습니다. 복구용 index와 잠금을 보존했습니다.');
      await lock.writeFile(await readFile(temporary)); await lock.sync(); await lock.close(); await rename(lockPath, index); published = true;
      if (committedTree !== tree || JSON.stringify(parents) !== JSON.stringify(expectedParent ? [expectedParent] : []) || !isDeepStrictEqual(actualTrailers, [...trailers].sort())) throw new InitError('COMMIT_CHANGED_BY_HOOK_OR_CONCURRENT_WRITE', '커밋은 생성됐지만 훅 또는 동시 작업이 내용·트레일러를 바꿨습니다. HEAD와 staged 변경을 확인하세요.');
      return { outcome: 'committed', commit, paths: actual, policy: plan.policy, evidence: plan.evidence, pushed: false };
    } finally {
      await lock.close().catch(() => {});
      // Once Git may have moved HEAD, leave recovery artifacts on an uncertain failure.
      if (published || !commitStarted) {
        if (!published) { const info = await lstat(lockPath).catch(() => null); if (info?.ino === owned.ino && info.dev === owned.dev) await unlink(lockPath); }
        await unlink(temporary).catch(() => {});
      }
    }
  }, env);
}
