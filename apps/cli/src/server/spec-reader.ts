import { comparePreviewBundles, SpecPreviewError, parseManagedConfig, emptyBundle, WIKI_DIR, type PreviewBundle } from '@gitifact/core';
import { browserSpecsV2, type BrowserSpecsV2 } from '@gitifact/contracts';
import { createGitRunner } from '../adapters/git/run-git.js';
import { LegacyBaselineError, specPreviewReader } from '../adapters/git/spec-preview-reader.js';
import { readWorkingPreviewState } from '../adapters/filesystem/spec-preview-store.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';
import { t } from '../shared/i18n/index.js';

export function createSpecBrowserReader(root: string, sessionId: string, inherited = process.env) {
  const reader = specPreviewReader(root); const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) => (await runner(['--no-optional-locks', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 16 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  const readHead = async () => {
    const head = (await git(['rev-parse','--verify','--quiet','HEAD'],[0,1])).trim();
    if (head && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new SpecPreviewError(t('specReader.headUnreadable'));
    if (!head) await reader.baseline();
    return head || null;
  };
  const snapshots = new Map<string, Promise<PreviewBundle>>();
  const snapshot = (oid: string) => {
    let value = snapshots.get(oid);
    if (!value) { value = reader.readBundle(oid).catch(e => { snapshots.delete(oid); throw e; }); snapshots.set(oid, value); }
    if (snapshots.size > 128) snapshots.delete(snapshots.keys().next().value!);
    return value;
  };
  let peopleCache: { key: string; data: BrowserSpecsV2['contributors']; limited: boolean } | undefined;
  const pending = new Map<string, Promise<BrowserSpecsV2>>();
  async function read(cursor: number, expectedHead?: string) {
    const raw = await readConfigFile(root);
    if (!raw || !('schemaVersion' in parseManagedConfig(raw))) throw new SpecPreviewError(t('specReader.schemaRequired'));
    const base = { head: await readHead() };
    if (cursor > 0 && expectedHead !== base.head) throw new SpecPreviewError(t('specReader.historyChanged'));
    const current = await readWorkingPreviewState(root);
    const bare = current.specs.map(({ history: _history, ...s }) => ({ ...s, contributors: [] as BrowserSpecsV2['contributors'], updatedAt: null as string | null }));
    const bareDocuments = current.wiki.documents.map(d => ({ ...d, updatedAt: null as string | null }));
    if (!base.head) return browserSpecsV2.parse({ contract: 'browser-specs', version: 2, sessionId, head: null, observedAt: new Date().toISOString(), working: bare.length > 0 || bareDocuments.length > 0, features: bare, documents: bareDocuments, events: [], contributors: [], contributorsLimited: false, nextCursor: null, boundary: false });
    const head = base.head;
    // Authors per feature folder, following the folder through the store rename; capped so a long history stays bounded.
    const features = await Promise.all(bare.map(async feature => {
      const folder = feature.path.replace(/^\.(?:gitifact|tryce)\/(spec\/[^/]+)\/requirements\.md$/, '$1');
      const lines = (await git(['log', '--format=%aN%x00%aE%x00%aI', '--max-count=2000', head, '--', `.gitifact/${folder}`, `.tryce/${folder}`])).trim().split('\n').filter(Boolean);
      const people = new Map<string, BrowserSpecsV2['contributors'][number]>();
      for (const line of lines) {
        const [name, email, latest] = line.split('\0'); if (!name || !email || !latest) throw new SpecPreviewError(t('specReader.authorUnreadable'));
        const person = people.get(email); if (person) person.commits++; else people.set(email, { name, email, latest, commits: 1 });
      }
      return { ...feature, contributors: [...people.values()].sort((a, b) => b.commits - a.commits), updatedAt: lines[0]?.split('\0')[2] ?? null };
    }));
    // Wiki pages record their latest commit by current path; a moved page restarts at the move commit.
    const documents = await Promise.all(bareDocuments.map(async doc => ({ ...doc, updatedAt: (await git(['log', '--format=%aI', '--max-count=1', head, '--', doc.path])).trim() || null })));
    const documentDirs = [WIKI_DIR];
    const [rows, dirty] = await Promise.all([
      git(['log', '--first-parent', '--date-order', '--format=%H%x00%P%x00%aN%x00%aE%x00%aI%x00%cN%x00%s', '--max-count=11', '--skip=' + cursor, head, '--',
        ...['.gitifact', '.tryce'].flatMap(d => [`:(glob)${d}/spec/*/requirements.md`, `:(glob)${d}/spec/*/design.md`, `:(glob)${d}/spec/*/history.jsonl`]),
        ...documentDirs.flatMap(d => [`:(glob)${d}/**/*.md`, `:(glob)${d}/history.jsonl`])]),
      git(['status', '--porcelain=v1', '--', '.gitifact/spec', ...documentDirs]),
    ]);
    // Git mailmap may change without a new HEAD; refresh names with every observation.
    {
      const people = new Map<string, BrowserSpecsV2['contributors'][number]>();
      const lines = (await git(['log', '--format=%aN%x00%aE%x00%aI', '--max-count=10001', head])).trim().split('\n').filter(Boolean);
      for (const line of lines.slice(0, 10000)) {
        const [name, email, latest] = line.split('\0'); if (!name || !email || !latest) throw new SpecPreviewError(t('specReader.authorUnreadable'));
        const person = people.get(email); if (person) person.commits++; else people.set(email, { name, email, latest, commits: 1 });
      }
      peopleCache = { key: head, data: [...people.values()].sort((a,b) => b.commits - a.commits), limited: lines.length > 10000 };
    }
    const commits = rows.trim().split('\n').filter(Boolean); let boundary = false;
    const groups = await Promise.all(commits.slice(0, 10).map(async row => {
      const [commit, parents, author, email, date, committer, message] = row.split('\0');
      if (!commit || author === undefined || email === undefined || !date || committer === undefined || message === undefined) throw new SpecPreviewError(t('specReader.historyUnreadable'));
      const after = await snapshot(commit); let before: PreviewBundle = emptyBundle();
      const parent = parents?.split(' ')[0];
      if (parent) {
        try { before = await snapshot(parent); }
        catch (error) { if (error instanceof LegacyBaselineError) boundary = true; else throw error; }
      }
      return comparePreviewBundles(before, after).changes.map(c => ({ key: commit + ':' + c.id, commit, author, email, date, committer, message,
        id: c.id, kind: c.kind, types: c.types, before: c.before, after: c.after, reasons: c.reasons.map(r => r.reason) }));
    }));
    if (await readHead() !== head || (await readWorkingPreviewState(root)).stamp !== current.stamp) throw new SpecPreviewError(t('specReader.projectChanged'));
    return browserSpecsV2.parse({ contract: 'browser-specs', version: 2, sessionId, head, observedAt: new Date().toISOString(), working: !!dirty.trim(), features, documents,
      events: groups.flat(), contributors: peopleCache.data, contributorsLimited: peopleCache.limited, nextCursor: commits.length > 10 ? cursor + 10 : null, boundary });
  }
  return (cursor = 0, head?: string) => {
    const key = `${cursor}:${head ?? ''}`; let value = pending.get(key);
    if (!value) { value = read(cursor, head).finally(() => pending.delete(key)); pending.set(key, value); }
    return value;
  };
}
