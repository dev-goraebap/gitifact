import { comparePreviewBundles, emptyBundle, parsePreviewBundle, recordPathPattern, SpecPreviewError, STORE_DIRS, WIKI_DIR, WIKI_HISTORY_PATH, type PreviewBundle, type PreviewChange } from '@gitifact/core';
import { LegacyBaselineError, specPreviewReader } from '../../adapters/git/spec-preview-reader.js';
import { t } from '../../shared/i18n/index.js';

/** One change of one commit, with the full text on both sides. Lists send it without the text. */
export interface HistoryEvent {
  key: string; commit: string; date: string; author: string; email: string; committer: string; message: string;
  id: string; kind: PreviewChange['kind']; types: PreviewChange['types'];
  before: PreviewChange['before']; after: PreviewChange['after']; reasons: string[];
}
export interface CommitChanges { commit: string; events: HistoryEvent[]; boundary: boolean }
interface RawEntry { oldBlob: string; newBlob: string; path: string }
interface RawCommit { commit: string; parent: string | undefined; author: string; email: string; date: string; committer: string; message: string; entries: RawEntry[] }

/** The record files a commit must touch to appear in the history: specs, designs, reasons and wiki pages. */
export const HISTORY_PATHSPECS = [...STORE_DIRS.flatMap(d => [`:(glob)${d}/spec/*/requirements.md`, `:(glob)${d}/spec/*/design.md`, `:(glob)${d}/spec/*/history.jsonl`]),
  `:(glob)${WIKI_DIR}/**/*.md`, `:(glob)${WIKI_HISTORY_PATH}`];
const RECORD_ROOTS = [...STORE_DIRS.map(d => d + '/spec/'), WIKI_DIR + '/'];
const isLegacy = (path: string) => RECORD_ROOTS.some(root => path.startsWith(root)) && path.endsWith('/tryce.json');
const isZero = (oid: string) => /^0+$/.test(oid);
const FORMAT = '%x1e%H%x00%P%x00%aN%x00%aE%x00%aI%x00%cN%x00%s';
// Commits read per git call; a long history is read in several calls rather than one unbounded answer.
const BATCH = 100;

/**
 * The changes each commit made, read from what the commit changed.
 *
 * Comparing the whole store at a commit and at its parent took two Git processes and a parse of every spec and page
 * per commit; on Windows a Git process costs about 80 ms whatever it does. Here one `git log --raw` names the files
 * a batch of commits changed, and one `git cat-file --batch` reads, at both sides of every commit, only the feature
 * folders and wiki files those changes touched. Comparing those partial stores gives the same changes and reasons,
 * because a reason must name records changed in its commit and every changed record lives in a changed file. A
 * commit that cannot be read this way is compared whole, so an unusual history is still read the way it was — or
 * fails the way it did.
 */
export function createCommitChanges(root: string, snapshot: (oid: string) => Promise<PreviewBundle>) {
  const reader = specPreviewReader(root);

  function parseLog(text: string): RawCommit[] {
    return text.split('\x1e').filter(chunk => chunk.length).map(chunk => {
      const parts = chunk.split('\0');
      const [commit, parents, author, email, date, committer, message] = parts;
      if (!commit || parents === undefined || author === undefined || email === undefined || !date || committer === undefined || message === undefined) throw new SpecPreviewError(t('specReader.historyUnreadable'));
      const entries: RawEntry[] = [];
      for (let i = 7; i < parts.length; i++) {
        const meta = parts[i]!.replace(/^\n/, '');
        if (!meta.startsWith(':')) continue;
        const [, , oldBlob, newBlob] = meta.split(' '); const path = parts[++i];
        if (!oldBlob || !newBlob || path === undefined) throw new SpecPreviewError(t('specReader.historyUnreadable'));
        if (recordPathPattern.test(path) || isLegacy(path)) entries.push({ oldBlob, newBlob, path });
      }
      return { commit, parent: parents.split(' ')[0] || undefined, author, email, date, committer, message, entries };
    });
  }

  // `<rev>:<path>` names for every file one side of a commit needs: each changed feature folder whole (its
  // requirements, design and reasons belong together, and the parser refuses a design without its requirements)
  // and the changed wiki pages with the wiki's reasons.
  function wanted(entries: RawEntry[]) {
    const folders = new Set<string>(); const pages = new Set<string>();
    for (const { path } of entries) {
      if (isLegacy(path)) continue;
      if (path.startsWith(WIKI_DIR + '/')) { pages.add(path); pages.add(WIKI_HISTORY_PATH); continue; }
      folders.add(path.replace(/\/[^/]+$/, ''));
    }
    return [...[...folders].flatMap(f => ['requirements.md', 'design.md', 'history.jsonl'].map(n => f + '/' + n)), ...pages];
  }

  async function readBlobs(names: string[]): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (!names.length) return found;
    const output = await reader.run(['cat-file', '--batch'], Buffer.from(names.join('\n') + '\n'));
    let offset = 0; let total = 0;
    for (const name of names) {
      const end = output.indexOf(10, offset);
      if (end < 0) throw new SpecPreviewError(t('reader.blobBoundary'));
      const header = output.subarray(offset, end).toString('utf8');
      if (header.endsWith(' missing')) { offset = end + 1; continue; }
      const [, type, sizeText] = header.split(' '); const size = Number(sizeText);
      if (type !== 'blob' || !Number.isSafeInteger(size) || size < 0 || size > 1024 * 1024 || output[end + size + 1] !== 10) throw new SpecPreviewError(t('reader.blobShape'));
      total += size; if (total > 64 * 1024 * 1024) throw new SpecPreviewError(t('reader.totalLimit'));
      found.set(name, reader.decode(output.subarray(end + 1, end + 1 + size))); offset = end + size + 2;
    }
    if (offset !== output.length) throw new SpecPreviewError(t('reader.blobBoundary'));
    return found;
  }

  const eventsOf = (c: RawCommit, changes: PreviewChange[]): HistoryEvent[] => changes.map(change => ({
    key: c.commit + ':' + change.id, commit: c.commit, author: c.author, email: c.email, date: c.date, committer: c.committer, message: c.message,
    id: change.id, kind: change.kind, types: change.types, before: change.before, after: change.after, reasons: change.reasons.map(r => r.reason),
  }));

  // The whole-store comparison, kept for the commits the partial read declines.
  async function wholeStore(c: RawCommit): Promise<CommitChanges> {
    const after = await snapshot(c.commit); let before = emptyBundle(); let boundary = false;
    if (c.parent) {
      try { before = await snapshot(c.parent); }
      catch (error) { if (error instanceof LegacyBaselineError) boundary = true; else throw error; }
    }
    return { commit: c.commit, events: eventsOf(c, comparePreviewBundles(before, after).changes), boundary };
  }

  async function batch(commits: RawCommit[]): Promise<CommitChanges[]> {
    // A commit whose own records are still legacy JSON goes the old way, which reads or refuses it as before.
    const names = new Map<RawCommit, { before: string[]; after: string[]; boundary: boolean }>();
    for (const c of commits.filter(c => !c.entries.some(e => isLegacy(e.path) && !isZero(e.newBlob)))) {
      const files = wanted(c.entries);
      const boundary = c.entries.some(e => isLegacy(e.path) && !isZero(e.oldBlob));
      names.set(c, { after: files.map(f => c.commit + ':' + f), before: c.parent && !boundary ? files.map(f => c.parent + ':' + f) : [], boundary });
    }
    let blobs: Map<string, string> | undefined;
    try { blobs = await readBlobs([...names.values()].flatMap(n => [...n.before, ...n.after])); }
    catch { blobs = undefined; }
    const result: CommitChanges[] = [];
    for (const c of commits) {
      let value: CommitChanges | undefined;
      const want = names.get(c);
      if (want && blobs) {
        try {
          const side = (list: string[], rev: string) => new Map(list.filter(name => blobs!.has(name)).map(name => [name.slice(rev.length + 1), blobs!.get(name)!]));
          const after = parsePreviewBundle(side(want.after, c.commit));
          const before = want.before.length ? parsePreviewBundle(side(want.before, c.parent!)) : emptyBundle();
          value = { commit: c.commit, events: eventsOf(c, comparePreviewBundles(before, after).changes), boundary: want.boundary };
        } catch { value = undefined; }
      }
      result.push(value ?? await wholeStore(c));
    }
    return result;
  }

  return {
    /** The commits of `head`'s first-parent history that touched records, newest first. One Git process. */
    async lineage(head: string): Promise<string[]> {
      const text = reader.decode(await reader.run(['rev-list', '--first-parent', head, '--', ...HISTORY_PATHSPECS]));
      return text.split('\n').filter(Boolean);
    },
    /** The changes of the given commits, in the given order; two Git processes per hundred commits. */
    async of(commits: string[]): Promise<CommitChanges[]> {
      const out: CommitChanges[] = [];
      for (let i = 0; i < commits.length; i += BATCH) {
        const slice = commits.slice(i, i + BATCH);
        // --no-walk reads exactly these commits; --diff-merges=first-parent gives a merge the changes it brought in.
        const raw = parseLog(reader.decode(await reader.run(['log', '--stdin', '--no-walk=unsorted', '--diff-merges=first-parent', '--raw', '-z', '--no-renames', '--no-abbrev', `--format=${FORMAT}`],
          Buffer.from(slice.join('\n') + '\n'))));
        const byCommit = new Map(raw.map(c => [c.commit, c]));
        const missing = slice.find(oid => !byCommit.has(oid));
        if (missing) throw new SpecPreviewError(t('specReader.historyUnreadable'));
        out.push(...await batch(slice.map(oid => byCommit.get(oid)!)));
      }
      return out;
    },
  };
}
