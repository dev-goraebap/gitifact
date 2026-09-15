import { compareSpecPreviews, SpecPreviewError, parseManagedConfig, type PreviewSpec } from '@tryce/core';
import { browserSpecsV1, type BrowserSpecsV1 } from '@tryce/contracts';
import { createGitRunner } from '../adapters/git/run-git.js';
import { specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { readWorkingPreviewState } from '../adapters/filesystem/spec-preview-store.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';

export function createSpecBrowserReader(root: string, sessionId: string, inherited = process.env) {
  const reader = specPreviewReader(root); const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) => (await runner(['--no-optional-locks', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 16 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  const readHead = async () => {
    const head = (await git(['rev-parse','--verify','--quiet','HEAD'],[0,1])).trim();
    if (head && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new SpecPreviewError('HEAD를 읽지 못했습니다.');
    if (!head) await reader.baseline();
    return head || null;
  };
  const snapshots = new Map<string, Promise<PreviewSpec[]>>();
  const snapshot = (oid: string) => {
    let value = snapshots.get(oid);
    if (!value) { value = reader.read(oid).catch(e => { snapshots.delete(oid); throw e; }); snapshots.set(oid, value); }
    if (snapshots.size > 128) snapshots.delete(snapshots.keys().next().value!);
    return value;
  };
  let peopleCache: { key: string; data: BrowserSpecsV1['contributors']; limited: boolean } | undefined;
  const pending = new Map<string, Promise<BrowserSpecsV1>>();
  async function read(cursor: number, expectedHead?: string) {
    const raw = await readConfigFile(root);
    if (!raw || !('schemaVersion' in parseManagedConfig(raw))) throw new SpecPreviewError('새 스키마 프로젝트가 필요합니다.');
    const base = { head: await readHead() };
    if (cursor > 0 && expectedHead !== base.head) throw new SpecPreviewError('이력이 바뀌었습니다. 새로고침 후 다시 조회하세요.');
    const current = await readWorkingPreviewState(root);
    const features = current.specs.map(({ history: _history, ...s }) => s);
    if (!base.head) return browserSpecsV1.parse({ contract: 'browser-specs', version: 1, sessionId, head: null, observedAt: new Date().toISOString(), working: features.length > 0, features, events: [], contributors: [], contributorsLimited: false, nextCursor: null, boundary: false });
    const head = base.head;
    const [rows, dirty] = await Promise.all([
      git(['log', '--first-parent', '--date-order', '--format=%H%x00%P%x00%aN%x00%aE%x00%aI%x00%cN%x00%s', '--max-count=11', '--skip=' + cursor, head, '--', ':(glob).tryce/spec/*/requirements.md', ':(glob).tryce/spec/*/design.md', ':(glob).tryce/spec/*/history.jsonl']),
      git(['status', '--porcelain=v1', '--', '.tryce/spec']),
    ]);
    // Git mailmap may change without a new HEAD; refresh names with every observation.
    {
      const people = new Map<string, BrowserSpecsV1['contributors'][number]>();
      const lines = (await git(['log', '--format=%aN%x00%aE%x00%aI', '--max-count=10001', head])).trim().split('\n').filter(Boolean);
      for (const line of lines.slice(0, 10000)) {
        const [name, email, latest] = line.split('\0'); if (!name || !email || !latest) throw new SpecPreviewError('Git 작성자를 읽지 못했습니다.');
        const person = people.get(email); if (person) person.commits++; else people.set(email, { name, email, latest, commits: 1 });
      }
      peopleCache = { key: head, data: [...people.values()].sort((a,b) => b.commits - a.commits), limited: lines.length > 10000 };
    }
    const commits = rows.trim().split('\n').filter(Boolean); let boundary = false;
    const groups = await Promise.all(commits.slice(0, 10).map(async row => {
      const [commit, parents, author, email, date, committer, message] = row.split('\0');
      if (!commit || author === undefined || email === undefined || !date || committer === undefined || message === undefined) throw new SpecPreviewError('Git 이력 형식을 읽지 못했습니다.');
      const after = await snapshot(commit); let before: PreviewSpec[] = [];
      const parent = parents?.split(' ')[0];
      if (parent) {
        try { before = await snapshot(parent); }
        catch (error) { if (error instanceof SpecPreviewError && error.message.includes('기존 JSON')) boundary = true; else throw error; }
      }
      return compareSpecPreviews(before, after).changes.map(c => ({ key: commit + ':' + c.id, commit, author, email, date, committer, message,
        id: c.id, kind: c.kind, types: c.types, before: c.before, after: c.after, reasons: c.reasons.map(r => r.reason) }));
    }));
    if (await readHead() !== head || (await readWorkingPreviewState(root)).stamp !== current.stamp) throw new SpecPreviewError('조회 중 프로젝트가 바뀌었습니다. 새로고침하세요.');
    return browserSpecsV1.parse({ contract: 'browser-specs', version: 1, sessionId, head, observedAt: new Date().toISOString(), working: !!dirty.trim(), features,
      events: groups.flat(), contributors: peopleCache.data, contributorsLimited: peopleCache.limited, nextCursor: commits.length > 10 ? cursor + 10 : null, boundary });
  }
  return (cursor = 0, head?: string) => {
    const key = `${cursor}:${head ?? ''}`; let value = pending.get(key);
    if (!value) { value = read(cursor, head).finally(() => pending.delete(key)); pending.set(key, value); }
    return value;
  };
}
