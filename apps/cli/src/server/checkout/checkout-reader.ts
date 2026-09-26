import { StoreError, parseManagedConfig, docProblem, arrangeDocuments, INSTRUCTIONS_ROOT, type DesignDoc } from '@gitifact/core';
import type { DesignSource } from '@gitifact/contracts';
import { createGitRunner } from '../../adapters/git/run-git.js';
import { storeReader } from '../../adapters/git/store-reader.js';
import { readConfigFile } from '../../adapters/filesystem/config-file.js';
import { readInstructionFiles } from '../../adapters/filesystem/instruction-folder.js';
import { readAgentsFile } from '../../adapters/filesystem/agents-file.js';
import type { Cache, FolderAuthors } from '../../adapters/cache/index.js';
import { documentStates, type DocumentStates } from '../../queries/document-states.js';
import type { CheckoutBase } from '../../queries/checkout.js';
import { createStampReader } from './stamp.js';
import { t, getLanguage } from '../../shared/i18n/index.js';

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
const folderOf = (path: string) => path.split('/').slice(0, 3).join('/');

/**
 * The documents in the shape the screens read: features with their requirements and designs in order, and the
 * instructions, each with where it stands against the last commit. Deleted documents are among them until committed.
 */
function checkoutDocuments(states: DocumentStates, authors: Map<string, FolderAuthors>) {
  const documents = states.documents;
  const standing = (id: string) => { const previousPath = states.previousPath(id); return { state: states.state(id), ...(previousPath ? { previousPath } : {}) }; };
  const byId = new Map(documents.map(d => [d.id, d]));
  const source = (s: DesignDoc['sources'][number]): DesignSource => {
    if (!('id' in s)) return { title: s.title, url: s.url, ...(s.note ? { note: s.note } : {}) };
    const target = byId.get(s.id);
    return { id: s.id, ...(target ? { title: target.title, path: target.path } : {}), ...(s.note ? { note: s.note } : {}) };
  };
  const arranged = arrangeDocuments(documents);
  const features = arranged.features.map(({ index, requirements, designs }) => {
    const entry = authors.get(folderOf(index.path));
    return { id: index.id, path: index.path, title: index.title, description: index.description, body: index.body, ...standing(index.id),
      requirements: requirements.map(r => ({ id: r.id, path: r.path, title: r.title, description: r.description, order: r.order, body: r.body, ...standing(r.id) })),
      designs: designs.map(d => ({ id: d.id, path: d.path, title: d.title, description: d.description, order: d.order, body: d.body,
        requirements: d.requirements, sources: d.sources.map(source), ...standing(d.id) })),
      // Who committed to the feature folder, most first, and when it was last touched; nobody until first committed.
      contributors: entry?.people ?? [], updatedAt: entry?.latest ?? null };
  });
  const instructions = arranged.instructions.map(k => ({ id: k.id, name: k.name, path: k.path, title: k.title, description: k.description, body: k.body, ...standing(k.id),
    updatedAt: authors.get(folderOf(k.path))?.latest ?? null }));
  return { features, instructions, orphans: arranged.orphans };
}

/**
 * The working tree as the browser's queries read it (`queries/checkout.ts`): the features and instructions with where
 * each stands, who wrote them, whether anything is uncommitted, and the stamp it was read at. The Git and file reads
 * are here; what a screen is given is worked out in the queries.
 */
export function createCheckoutReader(root: string, cache: Cache, inherited = process.env) {
  const reader = storeReader(root); const runner = createGitRunner();
  const env = { ...inherited, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const git = async (args: string[], acceptedExitCodes = [0]) => (await runner(['--no-optional-locks', ...args], { cwd: root, env, timeoutMs: 15000, maxBytes: 32 * 1024 * 1024, acceptedExitCodes })).toString('utf8');
  const readHead = async () => {
    const head = (await git(['rev-parse','--verify','--quiet','HEAD'],[0,1])).trim();
    if (head && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new StoreError(t('specReader.headUnreadable'));
    if (!head) await reader.baseline();
    return head || null;
  };
  const pending = new Map<string, Promise<CheckoutBase>>();
  const readStamp = createStampReader(root, inherited);

  async function read(): Promise<CheckoutBase> {
    const raw = await readConfigFile(root);
    if (!raw) throw new StoreError(t('specReader.schemaRequired'));
    parseManagedConfig(raw);
    const head = await readHead();
    // Taken before the reads, so a change made while they run leaves the stamp behind and the browser says so.
    const stamp = await readStamp();
    const [current, dirty, authors, people] = await settled([
      cache.documents.list(),
      head ? git(['status', '--porcelain=v1', '--', '.gitifact/spec', INSTRUCTIONS_ROOT]) : Promise.resolve(''),
      // Who touched each folder and who committed at all, counted over the commit log in the cache.
      head ? cache.log.folders(head) : Promise.resolve(new Map<string, FolderAuthors>()),
      head ? cache.log.contributors(head) : Promise.resolve([]),
    ] as const);
    const states = await documentStates({ head: async () => head, reader }, current.documents);
    const { features, instructions, orphans } = checkoutDocuments(states, authors);
    const problems = [...current.problems, ...orphans.map(feature => docProblem('FEATURE_INDEX_REQUIRED', `.gitifact/spec/${feature}/index.md`, { feature }))];
    if (await readHead() !== head) throw new StoreError(t('specReader.projectChanged'));
    return { head, stamp, observedAt: new Date().toISOString(), working: head ? !!dirty.trim() : features.length > 0 || instructions.length > 0,
      features, instructions, problems, people, folders: authors };
  }

  /** Concurrent callers share one read per language, including its errors. */
  const base = () => {
    const language = getLanguage();
    let value = pending.get(language);
    if (!value) { value = read().finally(() => pending.delete(language)); pending.set(language, value); }
    return value;
  };
  return {
    base,
    /** Every instruction by name with the other files of its folder, and AGENTS.md: few enough to read whole. */
    async instructions() {
      const checkout = await base();
      const instructions = await Promise.all([...checkout.instructions].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(async instruction => {
        // A deleted instruction's folder is gone; it lists no files until the commit takes it away.
        const { files, limited } = instruction.state === 'deleted' ? { files: [], limited: false } : await readInstructionFiles(root, instruction.path);
        return { ...instruction, files, filesLimited: limited };
      }));
      const agentsText = await readAgentsFile(root);
      return { instructions, agents: agentsText === null ? null : { path: 'AGENTS.md', body: agentsText, updatedAt: checkout.folders.get('AGENTS.md')?.latest ?? null } };
    },
  };
}
