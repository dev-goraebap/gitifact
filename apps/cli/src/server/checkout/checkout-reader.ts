import { StoreError, parseManagedConfig, docProblem, WIKI_ROOT, type Doc, type DesignDoc, type RequirementDoc } from '@gitifact/core';
import { browserSpecsV5, type BrowserSpecsV5, type DesignSource } from '@gitifact/contracts';
import { createGitRunner } from '../../adapters/git/run-git.js';
import { storeReader } from '../../adapters/git/store-reader.js';
import { readConfigFile } from '../../adapters/filesystem/config-file.js';
import { MIGRATION_TRAILER, type Cache } from '../../adapters/cache/index.js';
import { t, getLanguage } from '../../shared/i18n/index.js';

type Contributor = BrowserSpecsV5['contributors'][number];
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
const byOrder = <T extends { order: number; path: string }>(a: T, b: T) => a.order - b.order || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const folderOf = (path: string) => path.split('/').slice(0, 3).join('/');

/** The documents grouped the way the screens read them: features with their requirements and designs in order, and the wiki. */
export function arrangeDocuments(documents: Doc[]) {
  const byId = new Map(documents.map(d => [d.id, d]));
  const source = (s: DesignDoc['sources'][number]): DesignSource => {
    if (!('id' in s)) return { title: s.title, url: s.url, ...(s.note ? { note: s.note } : {}) };
    const target = byId.get(s.id);
    return { id: s.id, ...(target ? { title: target.title, path: target.path } : {}), ...(s.note ? { note: s.note } : {}) };
  };
  const folders = new Map<string, { index?: Doc; requirements: RequirementDoc[]; designs: DesignDoc[] }>();
  const folder = (path: string) => { const key = folderOf(path); let f = folders.get(key); if (!f) folders.set(key, f = { requirements: [], designs: [] }); return f; };
  for (const doc of documents) {
    if (doc.kind === 'feature') folder(doc.path).index = doc;
    else if (doc.kind === 'requirement') folder(doc.path).requirements.push(doc);
    else if (doc.kind === 'design') folder(doc.path).designs.push(doc);
  }
  const features = []; const orphans: string[] = [];
  for (const [path, f] of [...folders].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // A folder without index.md has no feature ID to show its documents under; the check reports it.
    if (!f.index) { orphans.push(path); continue; }
    features.push({ id: f.index.id, path: f.index.path, title: f.index.title, description: f.index.description, body: f.index.body,
      requirements: f.requirements.sort(byOrder).map(r => ({ id: r.id, path: r.path, title: r.title, description: r.description, order: r.order, body: r.body })),
      designs: f.designs.sort(byOrder).map(d => ({ id: d.id, path: d.path, title: d.title, description: d.description, order: d.order, body: d.body,
        requirements: d.requirements, sources: d.sources.map(source) })) });
  }
  const wiki = documents.filter(d => d.kind === 'wiki').map(d => ({ id: d.id, path: d.path, title: d.title, description: d.description, body: d.body }));
  return { features, wiki, orphans };
}

/**
 * The checkout the browser shows: the features and wiki of the working tree from the cache, who wrote them, and
 * whether anything is uncommitted.
 */
export function createCheckoutReader(root: string, sessionId: string, cache: Cache, inherited = process.env) {
  const reader = storeReader(root); const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) => (await runner(['--no-optional-locks', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  const readHead = async () => {
    const head = (await git(['rev-parse','--verify','--quiet','HEAD'],[0,1])).trim();
    if (head && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new StoreError(t('specReader.headUnreadable'));
    if (!head) await reader.baseline();
    return head || null;
  };
  const pending = new Map<string, Promise<{ checkout: BrowserSpecsV5; head: string | null }>>();
  // A format migration rewrites every document but is nobody's work on them: it counts toward no author or date.
  const notMigration = ['-E', '--invert-grep', `--grep=^${MIGRATION_TRAILER}: `];

  /**
   * Authors per feature folder and the latest commit per wiki page, from one walk over the commits that touched the
   * store. It used to be one `git log` per feature and one per page — 85 processes for a project with 22 features
   * and 63 pages, about 80 ms each on Windows. A feature still counts at most 2000 commits.
   */
  async function storeAuthors(head: string) {
    const text = await git(['log', ...notMigration, '--format=%x1e%aN%x00%aE%x00%aI', '-z', '--name-only', '--no-renames', '--max-count=20000', head, '--', '.gitifact/spec', WIKI_ROOT]);
    const folders = new Map<string, { people: Map<string, Contributor>; count: number; latest: string }>();
    const pages = new Map<string, string>();
    for (const chunk of text.split('\x1e')) {
      if (!chunk) continue;
      const [name, email, date, ...paths] = chunk.split('\0');
      if (!name || !email || !date) throw new StoreError(t('specReader.authorUnreadable'));
      const seen = new Set<string>();
      for (const raw of paths) {
        const path = raw.replace(/^\n/, ''); if (!path) continue;
        const folder = /^(\.gitifact\/spec\/[^/]+)\//.exec(path)?.[1];
        if (folder && !seen.has(folder)) {
          seen.add(folder);
          let entry = folders.get(folder); if (!entry) folders.set(folder, entry = { people: new Map(), count: 0, latest: date });
          if (entry.count < 2000) { entry.count++; tally(entry.people, name, email, date); }
        }
        if (path.startsWith(WIKI_ROOT + '/') && !pages.has(path)) pages.set(path, date);
      }
    }
    return { folders, pages };
  }

  async function read() {
    const raw = await readConfigFile(root);
    if (!raw) throw new StoreError(t('specReader.schemaRequired'));
    parseManagedConfig(raw);
    const head = await readHead();
    const [current, dirty, authors, everyone] = await settled([
      cache.documents.list(),
      head ? git(['status', '--porcelain=v1', '--', '.gitifact/spec', WIKI_ROOT]) : Promise.resolve(''),
      head ? storeAuthors(head) : Promise.resolve(undefined),
      // Git mailmap may change without a new HEAD; refresh names with every observation that carries them.
      head ? git(['log', ...notMigration, '--format=%aN%x00%aE%x00%aI', '--max-count=10001', head]) : Promise.resolve(''),
    ] as const);
    const people = new Map<string, Contributor>();
    const lines = everyone.trim().split('\n').filter(Boolean);
    for (const line of lines.slice(0, 10000)) {
      const [name, email, latest] = line.split('\0'); if (!name || !email || !latest) throw new StoreError(t('specReader.authorUnreadable'));
      tally(people, name, email, latest);
    }
    const arranged = arrangeDocuments(current.documents);
    const features = arranged.features.map(feature => {
      const entry = authors?.folders.get(folderOf(feature.path));
      return { ...feature, contributors: entry ? [...entry.people.values()].sort((a, b) => b.commits - a.commits) : [], updatedAt: entry?.latest ?? null };
    });
    // Wiki pages record their latest commit by current path; a moved page restarts at the move commit.
    const documents = arranged.wiki.map(doc => ({ ...doc, updatedAt: authors?.pages.get(doc.path) ?? null }));
    const problems = [...current.problems, ...arranged.orphans.map(path => docProblem('FEATURE_INDEX_REQUIRED', path + '/index.md', { feature: path.split('/')[2] }))];
    if (await readHead() !== head) throw new StoreError(t('specReader.projectChanged'));
    const checkout = browserSpecsV5.parse({ contract: 'browser-specs', version: 5, sessionId, head, observedAt: new Date().toISOString(),
      working: head ? !!dirty.trim() : features.length > 0 || documents.length > 0, features, documents, problems,
      contributors: [...people.values()].sort((a, b) => b.commits - a.commits), contributorsLimited: lines.length > 10000 });
    return { checkout, head };
  }

  /** Concurrent callers share one read per language, including its errors. */
  return () => {
    const language = getLanguage();
    let value = pending.get(language);
    if (!value) { value = read().finally(() => pending.delete(language)); pending.set(language, value); }
    return value;
  };
}
