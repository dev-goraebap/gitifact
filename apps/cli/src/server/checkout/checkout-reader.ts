import { SpecPreviewError, parseManagedConfig, WIKI_DIR } from '@gitifact/core';
import { browserSpecsV4, type BrowserSpecsV4 } from '@gitifact/contracts';
import { createGitRunner } from '../../adapters/git/run-git.js';
import { specPreviewReader } from '../../adapters/git/spec-preview-reader.js';
import { readWorkingPreviewState } from '../../adapters/filesystem/spec-preview-store.js';
import { readConfigFile } from '../../adapters/filesystem/config-file.js';
import type { SearchDocument } from '../history/history-index.js';
import { t } from '../../shared/i18n/index.js';

type Contributor = BrowserSpecsV4['contributors'][number];
const tally = (people: Map<string, Contributor>, name: string, email: string, latest: string) => {
  const person = people.get(email); if (person) person.commits++; else people.set(email, { name, email, latest, commits: 1 });
};
/**
 * Like Promise.all, but a failure is reported only once every read has finished. The reads run side by side, and
 * answering on the first failure left Git processes running in the project after the request had ended.
 */
export async function settled<T extends readonly unknown[]>(reads: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const results = await Promise.allSettled(reads);
  const failure = results.find(r => r.status === 'rejected');
  if (failure) throw (failure as PromiseRejectedResult).reason;
  return results.map(r => (r as PromiseFulfilledResult<unknown>).value) as unknown as T;
}

/**
 * The checkout the browser shows: the specs and wiki of the working tree, who wrote them, and whether anything is
 * uncommitted. It is bounded by the store's own limits (2000 files, 16 MB), so it is read and sent whole, and the
 * screens that show it filter it themselves.
 */
export function createCheckoutReader(root: string, sessionId: string, inherited = process.env) {
  const reader = specPreviewReader(root); const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) => (await runner(['--no-optional-locks', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  const readHead = async () => {
    const head = (await git(['rev-parse','--verify','--quiet','HEAD'],[0,1])).trim();
    if (head && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new SpecPreviewError(t('specReader.headUnreadable'));
    if (!head) await reader.baseline();
    return head || null;
  };
  const pending = new Map<string, Promise<{ checkout: BrowserSpecsV4; stamp: string; search: SearchDocument[] }>>();

  /**
   * Authors per feature folder and the latest commit per wiki page, from one walk over the commits that touched the
   * store. It used to be one `git log` per feature and one per page — 85 processes for a project with 22 features
   * and 63 pages, about 80 ms each on Windows. A feature still counts at most 2000 commits.
   */
  async function storeAuthors(head: string) {
    const text = await git(['log', '--format=%x1e%aN%x00%aE%x00%aI', '-z', '--name-only', '--no-renames', '--max-count=20000', head, '--', '.gitifact', '.tryce']);
    const folders = new Map<string, { people: Map<string, Contributor>; count: number; latest: string }>();
    const pages = new Map<string, string>();
    for (const chunk of text.split('\x1e')) {
      if (!chunk) continue;
      const [name, email, date, ...paths] = chunk.split('\0');
      if (!name || !email || !date) throw new SpecPreviewError(t('specReader.authorUnreadable'));
      const seen = new Set<string>();
      for (const raw of paths) {
        const path = raw.replace(/^\n/, ''); if (!path) continue;
        const folder = /^\.(?:gitifact|tryce)\/(spec\/[^/]+)\//.exec(path)?.[1];
        if (folder && !seen.has(folder)) {
          seen.add(folder);
          let entry = folders.get(folder); if (!entry) folders.set(folder, entry = { people: new Map(), count: 0, latest: date });
          if (entry.count < 2000) { entry.count++; tally(entry.people, name, email, date); }
        }
        if (path.startsWith(WIKI_DIR + '/') && !pages.has(path)) pages.set(path, date);
      }
    }
    return { folders, pages };
  }

  async function read() {
    const raw = await readConfigFile(root);
    if (!raw || !('schemaVersion' in parseManagedConfig(raw))) throw new SpecPreviewError(t('specReader.schemaRequired'));
    const head = await readHead();
    const [current, dirty, authors, everyone] = await settled([
      readWorkingPreviewState(root),
      head ? git(['status', '--porcelain=v1', '--', '.gitifact/spec', WIKI_DIR]) : Promise.resolve(''),
      head ? storeAuthors(head) : Promise.resolve(undefined),
      // Git mailmap may change without a new HEAD; refresh names with every observation that carries them.
      head ? git(['log', '--format=%aN%x00%aE%x00%aI', '--max-count=10001', head]) : Promise.resolve(''),
    ] as const);
    const people = new Map<string, Contributor>();
    const lines = everyone.trim().split('\n').filter(Boolean);
    for (const line of lines.slice(0, 10000)) {
      const [name, email, latest] = line.split('\0'); if (!name || !email || !latest) throw new SpecPreviewError(t('specReader.authorUnreadable'));
      tally(people, name, email, latest);
    }
    // Authors per feature follow the folder through the store rename (.tryce → .gitifact keeps the folder name).
    const features = current.specs.map(({ history: _history, ...feature }) => {
      const entry = authors?.folders.get(feature.path.replace(/^\.(?:gitifact|tryce)\/(spec\/[^/]+)\/requirements\.md$/, '$1'));
      return { ...feature, contributors: entry ? [...entry.people.values()].sort((a, b) => b.commits - a.commits) : [], updatedAt: entry?.latest ?? null };
    });
    // Wiki pages record their latest commit by current path; a moved page restarts at the move commit.
    const documents = current.wiki.documents.map(doc => ({ ...doc, updatedAt: authors?.pages.get(doc.path) ?? null }));
    // The working store was read whole and twice over inside readWorkingPreviewState, so it is consistent in itself;
    // what can still move under this read is HEAD, which the authors came from.
    if (await readHead() !== head) throw new SpecPreviewError(t('specReader.projectChanged'));
    const checkout = browserSpecsV4.parse({ contract: 'browser-specs', version: 4, sessionId, head, observedAt: new Date().toISOString(),
      working: head ? !!dirty.trim() : features.length > 0 || documents.length > 0, features, documents,
      contributors: [...people.values()].sort((a, b) => b.commits - a.commits), contributorsLimited: lines.length > 10000 });
    // The same records as the search box finds them.
    const search: SearchDocument[] = features.flatMap((f): SearchDocument[] => [
      { kind: 'feature' as const, ref: f.id, title: f.title, where: f.path.replace(/^\.gitifact\//, ''), body: f.description, featureId: f.id },
      ...f.requirements.map(r => ({ kind: 'requirement' as const, ref: r.id, title: r.title, where: f.title, body: r.body, featureId: f.id })),
      ...(f.design ? [{ kind: 'design' as const, ref: f.id + ':design', title: f.design.title, where: f.title, body: f.design.body, featureId: f.id }] : []),
    ]).concat(documents.map(d => ({ kind: 'document' as const, ref: d.id, title: d.title, where: d.path.replace(/^\.gitifact\/wiki\//, ''), body: d.body, documentId: d.id })));
    return { checkout, stamp: current.stamp, search };
  }

  /** Concurrent callers share one read. */
  return () => {
    let value = pending.get('');
    if (!value) { value = read().finally(() => pending.delete('')); pending.set('', value); }
    return value;
  };
}
