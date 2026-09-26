import { StoreError, parseManagedConfig, docProblem, arrangeDocuments, INSTRUCTIONS_ROOT, type Doc, type DesignDoc } from '@gitifact/core';
import { browserSpecsV7, type BrowserSpecsV7, type DesignSource } from '@gitifact/contracts';
import { createGitRunner } from '../../adapters/git/run-git.js';
import { storeReader } from '../../adapters/git/store-reader.js';
import { readConfigFile } from '../../adapters/filesystem/config-file.js';
import { readInstructionFiles } from '../../adapters/filesystem/instruction-folder.js';
import { readAgentsFile } from '../../adapters/filesystem/agents-file.js';
import type { Cache, FolderAuthors } from '../../adapters/cache/index.js';
import { documentStates, type DocumentStates } from '../../queries/document-states.js';
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
function checkoutDocuments(states: DocumentStates) {
  const documents = states.documents;
  const standing = (id: string) => { const previousPath = states.previousPath(id); return { state: states.state(id), ...(previousPath ? { previousPath } : {}) }; };
  const byId = new Map(documents.map(d => [d.id, d]));
  const source = (s: DesignDoc['sources'][number]): DesignSource => {
    if (!('id' in s)) return { title: s.title, url: s.url, ...(s.note ? { note: s.note } : {}) };
    const target = byId.get(s.id);
    return { id: s.id, ...(target ? { title: target.title, path: target.path } : {}), ...(s.note ? { note: s.note } : {}) };
  };
  const arranged = arrangeDocuments(documents);
  const features = arranged.features.map(({ index, requirements, designs }) => ({ id: index.id, path: index.path, title: index.title, description: index.description, body: index.body,
    ...standing(index.id),
    requirements: requirements.map(r => ({ id: r.id, path: r.path, title: r.title, description: r.description, order: r.order, body: r.body, ...standing(r.id) })),
    designs: designs.map(d => ({ id: d.id, path: d.path, title: d.title, description: d.description, order: d.order, body: d.body,
      requirements: d.requirements, sources: d.sources.map(source), ...standing(d.id) })) }));
  const instructions = arranged.instructions.map(k => ({ id: k.id, name: k.name, path: k.path, title: k.title, description: k.description, body: k.body, ...standing(k.id) }));
  return { features, instructions, orphans: arranged.orphans };
}

/**
 * The checkout the browser shows: the features and instructions of the working tree and AGENTS.md, who wrote them, and
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
  const pending = new Map<string, Promise<{ checkout: BrowserSpecsV7; head: string | null }>>();
  const readStamp = createStampReader(root, inherited);
  async function read() {
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
    const arranged = checkoutDocuments(states);
    const features = arranged.features.map(feature => {
      const entry = authors.get(folderOf(feature.path));
      return { ...feature, contributors: entry?.people ?? [], updatedAt: entry?.latest ?? null };
    });
    const instructions = await Promise.all(arranged.instructions.map(async instruction => {
      // A deleted instruction's folder is gone; it lists no files until the commit takes it away.
      const { files, limited } = instruction.state === 'deleted' ? { files: [], limited: false } : await readInstructionFiles(root, instruction.path);
      return { ...instruction, files, filesLimited: limited, updatedAt: authors.get(folderOf(instruction.path))?.latest ?? null };
    }));
    const agentsText = await readAgentsFile(root);
    const agents = agentsText === null ? null : { path: 'AGENTS.md', body: agentsText, updatedAt: authors.get('AGENTS.md')?.latest ?? null };
    const problems = [...current.problems, ...arranged.orphans.map(feature => docProblem('FEATURE_INDEX_REQUIRED', `.gitifact/spec/${feature}/index.md`, { feature }))];
    if (await readHead() !== head) throw new StoreError(t('specReader.projectChanged'));
    const checkout = browserSpecsV7.parse({ contract: 'browser-specs', version: 7, sessionId, head, observedAt: new Date().toISOString(), stamp,
      working: head ? !!dirty.trim() : features.length > 0 || instructions.length > 0, features, instructions, agents, problems,
      contributors: people, contributorsLimited: false });
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
