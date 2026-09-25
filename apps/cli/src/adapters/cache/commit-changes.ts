import { t } from '../../shared/i18n/index.js';
import { classifyDocPath, isRecordPath, parseDocumentFile, parseReasonLines, parseRecordFile, emptyBundle as emptyStore, HISTORY_PATH, INSTRUCTIONS_ROOT, RECORDS_ROOT, SPEC_ROOT, WIKI_ROOT,
  type Doc, type DocKind, type DocReason, type StoreBundle } from '@gitifact/core';
import { legacyChanges } from './legacy-changes.js';
import { eventRecordOf, reasonRecord, recordsFor, type AttachedRecord } from './record-events.js';
import type { ChangeType, CommitChanges, DocSnapshot, HistoryEvent } from './events.js';

/**
 * Git run under the project's guarded environment, supplied by the caller so this adapter does not import another.
 * `legacyBundles` reads commits with the 0.7 parser, for history before a migration; without it that history is empty.
 */
export interface GitAccess { run(args: string[], input?: Buffer): Promise<Buffer>; decode(bytes: Buffer): string; legacyBundles?(oids: readonly string[]): Promise<Map<string, StoreBundle>> }

export type { DocSnapshot, SnapshotSource, ChangeType, HistoryEvent, CommitChanges } from './events.js';
interface RawCommit { commit: string; parent: string | undefined; parents: string[]; author: string; email: string; date: string; committer: string; message: string; paths: string[]; added: string[] }
/** How a commit is read: with the current parser, with the 0.7 parser (before a migration), or not at all (the migration itself). */
export type CommitReader = 'current' | 'legacy' | 'migration';
/** The trailer `changes commit` puts on a format migration. Its commit is where the current format's history starts. */
export const MIGRATION_TRAILER = 'Gitifact-Migration';
/** The documents of one side and the lines of its reason file (past commits only), read from some or all of its files. */
interface Side { docs: Map<string, DocSnapshot>; reasons: Map<string, DocReason> }

/** The files a commit must touch to appear in the history: features, requirements, designs, wiki pages, instructions, records and reasons. */
export const HISTORY_PATHSPECS = [
  `:(glob)${SPEC_ROOT}/*/index.md`, `:(glob)${SPEC_ROOT}/*/requirements/*.md`, `:(glob)${SPEC_ROOT}/*/design/*.md`,
  `:(glob)${WIKI_ROOT}/**/*.md`, `:(glob)${INSTRUCTIONS_ROOT}/*/index.md`, `:(glob)${RECORDS_ROOT}/*/*.md`, `:(literal)${HISTORY_PATH}`,
  // The 0.7 files, so the commits before a migration are in the lineage too. Removed with the 0.7 parser at 1.0.0.
  `:(glob)${SPEC_ROOT}/*/requirements.md`, `:(glob)${SPEC_ROOT}/*/design.md`, `:(glob)${SPEC_ROOT}/*/history.jsonl`, `:(literal)${WIKI_ROOT}/history.jsonl`,
];
const FORMAT = '%x1e%H%x00%P%x00%aN%x00%aE%x00%aI%x00%cN%x00%s';
const BATCH = 100;

const unreadable = () => new Error(t('specReader.historyUnreadable'));
/** Whether a path is a document or reason file; malformed paths in old commits are simply not records. */
const recordKind = (path: string) => { try { const type = classifyDocPath(path).type; return type === 'instruction-file' ? 'ignored' : type; } catch { return 'ignored'; } };
const folderOf = (path: string) => path.startsWith(SPEC_ROOT + '/') ? path.split('/').slice(0, 3).join('/') : null;

function snapshot(doc: Doc, specId: string): DocSnapshot {
  const base = { id: doc.id, kind: doc.kind, title: doc.title, description: doc.description, body: doc.body, specId, path: doc.path };
  if (doc.kind === 'requirement') return { ...base, order: doc.order };
  if (doc.kind === 'design') return { ...base, order: doc.order, requirements: doc.requirements, sources: doc.sources };
  return base;
}
/** The documents and reasons in `files` (path → text). A file that does not parse is left out rather than failing the history. */
function sideOf(files: Map<string, string>): Side {
  const specIds = new Map<string, string>();
  const docs: Doc[] = []; const reasons = new Map<string, DocReason>();
  for (const [path, text] of files) {
    try {
      if (recordKind(path) === 'reasons') { for (const r of parseReasonLines(path, text)) reasons.set(r.id, r); continue; }
      if (recordKind(path) === 'record') continue;
      const doc = parseDocumentFile(path, text); docs.push(doc);
      if (doc.kind === 'feature') specIds.set(folderOf(path)!, doc.id);
    } catch { /* not readable at this commit */ }
  }
  return { docs: new Map(docs.map(d => [d.id, snapshot(d, d.kind === 'wiki' || d.kind === 'instruction' ? d.kind : specIds.get(folderOf(d.path)!) ?? '')])), reasons };
}
const same = (a: DocSnapshot, b: DocSnapshot) => a.title === b.title && a.description === b.description && a.body === b.body
  && a.order === b.order && JSON.stringify(a.requirements) === JSON.stringify(b.requirements) && JSON.stringify(a.sources) === JSON.stringify(b.sources);
/** Documents compared by ID: a new path is a move, any other difference a modification. */
function compare(before: Side, after: Side) {
  const out: { id: string; kind: DocKind; types: ChangeType[]; before: DocSnapshot | null; after: DocSnapshot | null }[] = [];
  for (const id of [...new Set([...before.docs.keys(), ...after.docs.keys()])].sort()) {
    const from = before.docs.get(id) ?? null; const to = after.docs.get(id) ?? null;
    const types: ChangeType[] = [];
    if (!from) types.push('created'); else if (!to) types.push('deleted');
    else { if (from.path !== to.path) types.push('moved'); if (!same(from, to)) types.push('modified'); }
    if (types.length) out.push({ id, kind: (to ?? from)!.kind, types, before: from, after: to });
  }
  return out;
}

/**
 * The changes each commit made to the documents, read from what the commit changed. Documents are one file each, so
 * a commit's changes are the documents in its changed files: one `git log --raw` names those files for a batch of
 * commits and one `git cat-file --batch` reads them at both sides, with the feature's index.md for its ID. Reasons
 * are the lines a commit added to the one reason file, read for the whole batch by one `git log -p`, so the cost does
 * not grow with the file.
 */
export function createCommitChanges(git: GitAccess) {
  async function readBlobs(names: string[]): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (!names.length) return found;
    const output = await git.run(['cat-file', '--batch'], Buffer.from(names.join('\n') + '\n'));
    let offset = 0; let total = 0;
    for (const name of names) {
      const end = output.indexOf(10, offset);
      if (end < 0) throw unreadable();
      const header = output.subarray(offset, end).toString('utf8');
      if (header.endsWith(' missing')) { offset = end + 1; continue; }
      const [, type, sizeText] = header.split(' '); const size = Number(sizeText);
      if (type !== 'blob' || !Number.isSafeInteger(size) || size < 0 || output[end + size + 1] !== 10) throw unreadable();
      total += size; if (total > 256 * 1024 * 1024) throw unreadable();
      // A file that is not UTF-8 is not a readable document; it is left out like any other unparsable file.
      try { found.set(name, git.decode(output.subarray(end + 1, end + 1 + size))); } catch { /* skipped */ }
      offset = end + size + 2;
    }
    if (offset !== output.length) throw unreadable();
    return found;
  }
  const at = (blobs: Map<string, string>, rev: string, paths: string[]) =>
    new Map(paths.filter(p => blobs.has(rev + ':' + p)).map(p => [p, blobs.get(rev + ':' + p)!]));
  /** Every document and reason file of a commit, for merges, which compare whole trees. */
  async function tree(rev: string): Promise<Map<string, string>> {
    const listing = git.decode(await git.run(['ls-tree', '--full-tree', '-r', '-z', rev, '--', SPEC_ROOT, WIKI_ROOT, INSTRUCTIONS_ROOT, HISTORY_PATH]));
    const paths = listing.split('\0').filter(Boolean).map(row => /^\d+ blob [a-f0-9]+\t([\s\S]+)$/.exec(row)?.[1]).filter((p): p is string => !!p && recordKind(p) !== 'ignored' && recordKind(p) !== 'record');
    const blobs = await readBlobs(paths.map(p => rev + ':' + p));
    return at(blobs, rev, paths);
  }
  /** The files one side of an ordinary commit needs: its changed documents and the index.md of their folders. */
  function wanted(paths: string[]) {
    const names = new Set(paths.filter(p => p !== HISTORY_PATH && !isRecordPath(p)));
    for (const path of names) { const folder = folderOf(path); if (folder) names.add(folder + '/index.md'); }
    return [...names];
  }

  /**
   * The reason lines each ordinary commit added to the reason file records replaced, from one patch for all of them,
   * as records. A line that replaces an existing line keeps its ID and is an edit of an old reason, not a new one.
   * Only commits from before records carry them; this goes with the 0.7 reader at 1.0.0.
   */
  async function addedReasons(commits: RawCommit[]): Promise<Map<string, AttachedRecord[]>> {
    const found = new Map<string, AttachedRecord[]>();
    const touching = commits.filter(c => c.parents.length < 2 && c.paths.includes(HISTORY_PATH));
    if (!touching.length) return found;
    const patch = git.decode(await git.run(['log', '--stdin', '--no-walk=unsorted', '--format=%x1e%H', '-p', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '--', HISTORY_PATH],
      Buffer.from(touching.map(c => c.commit).join('\n') + '\n')));
    const read = (line: string) => { try { return parseReasonLines(HISTORY_PATH, line); } catch { return []; } };
    for (const chunk of patch.split('\x1e').filter(Boolean)) {
      const lines = chunk.split('\n'); const commit = lines[0]!.trim();
      const removed = new Set(lines.filter(l => l.startsWith('-') && !l.startsWith('---')).flatMap(l => read(l.slice(1))).map(r => r.id));
      found.set(commit, lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).flatMap(l => read(l.slice(1))).filter(r => !removed.has(r.id)).map(r => reasonRecord(r.id, r.docs, r.reason)));
    }
    return found;
  }

  function parseLog(text: string): RawCommit[] {
    return text.split('\x1e').filter(chunk => chunk.length).map(chunk => {
      const parts = chunk.split('\0');
      const [commit, parents, author, email, date, committer, message] = parts;
      if (!commit || parents === undefined || author === undefined || email === undefined || !date || committer === undefined || message === undefined) throw unreadable();
      const paths: string[] = []; const added: string[] = [];
      for (let i = 7; i < parts.length; i++) {
        const meta = parts[i]!.replace(/^\n/, '');
        if (!meta.startsWith(':')) continue;
        const path = parts[++i];
        if (path === undefined) throw unreadable();
        if (recordKind(path) === 'ignored') continue;
        paths.push(path);
        // A record is written once, so a commit's records are the record files it added.
        if (meta.trim().endsWith(' A') && isRecordPath(path)) added.push(path);
      }
      return { commit, parent: parents.split(' ')[0] || undefined, parents: parents.split(' ').filter(Boolean), author, email, date, committer, message, paths, added };
    });
  }

  // Both sides are read at the commit and its first parent, which is where the text is read again when it is asked for.
  const eventsOf = (c: RawCommit, changes: ReturnType<typeof compare>, records: AttachedRecord[]): HistoryEvent[] => changes.map(change => ({
    key: c.commit + ':' + change.id, commit: c.commit, author: c.author, email: c.email, date: c.date, committer: c.committer, message: c.message,
    id: change.id, kind: change.kind, types: change.types, before: change.before, after: change.after, records: recordsFor(records, change.id),
    source: { before: c.parent ?? null, after: c.commit },
  }));
  const newReasons = (before: Side[], after: Side) => [...after.reasons.values()].filter(r => before.every(b => !b.reasons.has(r.id))).map(r => reasonRecord(r.id, r.docs, r.reason));
  /** The records among `paths` read at `rev`; a record that does not parse is left out like any unreadable file. */
  const recordsAt = (blobs: Map<string, string>, rev: string, paths: string[]) => paths.flatMap(path => {
    const text = blobs.get(rev + ':' + path);
    try { return text === undefined ? [] : [eventRecordOf(parseRecordFile(path, text))]; } catch { return []; }
  });

  async function merge(c: RawCommit): Promise<CommitChanges> {
    let touched: Set<string> | undefined;
    const after = sideOf(await tree(c.commit));
    const parents = await Promise.all(c.parents.map(async p => sideOf(await tree(p))));
    if (c.parents.length === 2) {
      // Git uses a temporary object store for remerge-diff; neither the checkout nor its index is changed. A document is
      // touched by the merge itself when its file differs from what Git's own merge would have produced.
      const patch = git.decode(await git.run(['-c', 'merge.conflictStyle=merge', 'show', '--remerge-diff', '--format=', '--name-only', '-z',
        '--no-ext-diff', '--no-textconv', '--no-renames', c.commit, '--', ...HISTORY_PATHSPECS]));
      const paths = new Set(patch.split('\0').map(p => p.trim()).filter(Boolean));
      touched = new Set([...after.docs.values(), ...parents[0]!.docs.values()].filter(d => paths.has(d.path)).map(d => d.id));
      if (!touched.size) return { commit: c.commit, events: [] };
    }
    // Reasons imported from branches belong to their original commits; only reasons first written by the merge attach.
    const bare = (s: Side): Side => ({ docs: s.docs, reasons: new Map() });
    const differences = parents.map(p => compare(bare(p), bare(after)));
    // Git cannot remerge octopus commits. Keep documents that differ from every parent in that case.
    const selected = differences[0]!.filter(change => touched ? touched.has(change.id) : differences.every(d => d.some(v => v.id === change.id)));
    // Records the merge itself added: files no parent has.
    const addedBy = await Promise.all(c.parents.map(async p => git.decode(await git.run(['diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', p, c.commit, '--', RECORDS_ROOT]))
      .split('\0').filter(isRecordPath)));
    const own = addedBy[0]!.filter(path => addedBy.every(list => list.includes(path)));
    const blobs = await readBlobs(own.map(path => c.commit + ':' + path));
    return { commit: c.commit, events: eventsOf(c, selected, [...recordsAt(blobs, c.commit, own), ...newReasons(parents, after)]) };
  }

  async function batch(commits: RawCommit[], readers: Map<string, CommitReader>): Promise<CommitChanges[]> {
    const plain = commits.filter(c => c.parents.length < 2 && (readers.get(c.commit) ?? 'current') === 'current');
    const names = plain.flatMap(c => { const files = wanted(c.paths); return [...files.map(f => c.commit + ':' + f), ...(c.parent ? files.map(f => c.parent + ':' + f) : []), ...c.added.map(f => c.commit + ':' + f)]; });
    // The 0.7 commits of this batch: their own trees and their parents', read together because commits in a row
    // share most of their blobs. Without a bundle a commit reads as empty, the way an unreadable side always did.
    const legacy = git.legacyBundles ? commits.filter(c => readers.get(c.commit) === 'legacy') : [];
    const sides = [...new Set(legacy.flatMap(c => [c.commit, ...c.parents]))];
    const [blobs, reasons, bundles] = await Promise.all([readBlobs(names), addedReasons(plain),
      sides.length ? git.legacyBundles!(sides) : new Map<string, StoreBundle>()]);
    const legacyOf = new Map<string, HistoryEvent[]>();
    for (const c of legacy) legacyOf.set(c.commit, await legacyChanges(c, async oid => bundles.get(oid) ?? emptyStore()).catch(() => []));
    const result: CommitChanges[] = [];
    for (const c of commits) {
      const reader = readers.get(c.commit) ?? 'current';
      if (reader === 'migration') { result.push({ commit: c.commit, events: [] }); continue; }
      if (reader === 'legacy') { result.push({ commit: c.commit, events: legacyOf.get(c.commit) ?? [] }); continue; }
      if (c.parents.length > 1) { result.push(await merge(c)); continue; }
      const files = wanted(c.paths);
      const after = sideOf(at(blobs, c.commit, files));
      const before = c.parent ? sideOf(at(blobs, c.parent, files)) : { docs: new Map(), reasons: new Map() };
      // Only the documents in changed files belong to this commit; an index.md read for its ID is not a change.
      const changed = new Set(c.paths);
      const restrict = (s: Side): Side => ({ docs: new Map([...s.docs].filter(([, d]) => changed.has(d.path))), reasons: s.reasons });
      result.push({ commit: c.commit, events: eventsOf(c, compare(restrict(before), restrict(after)), [...recordsAt(blobs, c.commit, c.added), ...reasons.get(c.commit) ?? []]) });
    }
    return result;
  }

  return {
    /** Every document and reason file of a commit (path → text): what `specs show --ref` and `changes` compare against. */
    tree,
    /**
     * Documents read again at the commits and paths a change was read at, by one `cat-file --batch`: the text a
     * change's detail shows, which the cache does not keep. A place that no longer reads is null.
     */
    async sides(places: { rev: string; path: string; specId: string }[]): Promise<(DocSnapshot | null)[]> {
      const blobs = await readBlobs([...new Set(places.map(p => p.rev + ':' + p.path))]);
      return places.map(p => {
        const text = blobs.get(p.rev + ':' + p.path);
        try { return text === undefined ? null : snapshot(parseDocumentFile(p.path, text), p.specId); } catch { return null; }
      });
    },
    /** All reachable record commits, children before parents even when author clocks differ. */
    async lineage(head: string): Promise<string[]> {
      return git.decode(await git.run(['rev-list', '--full-history', '--date-order', head, '--', ...HISTORY_PATHSPECS])).split('\n').filter(Boolean);
    },
    /**
     * How each commit of `head`'s lineage is read. The newest migration commit reachable from `head` splits it: its
     * ancestors are 0.7 history, it is itself hidden, and everything after it is the current format.
     */
    async readers(head: string, lineage: string[]): Promise<Map<string, CommitReader>> {
      const readers = new Map<string, CommitReader>(lineage.map(oid => [oid, 'current']));
      const migrations = git.decode(await git.run(['log', '--format=%H', '-E', `--grep=^${MIGRATION_TRAILER}: `, head, '--', ...HISTORY_PATHSPECS])).split('\n').filter(Boolean);
      if (!migrations.length) return readers;
      const before = git.decode(await git.run(['rev-list', ...migrations, '--', ...HISTORY_PATHSPECS])).split('\n').filter(Boolean);
      for (const oid of before) if (readers.has(oid)) readers.set(oid, 'legacy');
      for (const oid of migrations) readers.set(oid, 'migration');
      return readers;
    },
    /** Changes in the given order; ordinary commits are batched, merges compare whole trees. */
    async of(commits: string[], readers: Map<string, CommitReader> = new Map()): Promise<CommitChanges[]> {
      const out: CommitChanges[] = [];
      for (let i = 0; i < commits.length; i += BATCH) {
        const slice = commits.slice(i, i + BATCH);
        // --no-walk reads exactly these commits; --diff-merges=first-parent gives a merge the changes it brought in.
        const raw = parseLog(git.decode(await git.run(['log', '--stdin', '--no-walk=unsorted', '--diff-merges=first-parent', '--raw', '-z', '--no-renames', '--no-abbrev', `--format=${FORMAT}`],
          Buffer.from(slice.join('\n') + '\n'))));
        const byCommit = new Map(raw.map(c => [c.commit, c]));
        if (slice.some(oid => !byCommit.has(oid))) throw unreadable();
        out.push(...await batch(slice.map(oid => byCommit.get(oid)!), readers));
      }
      return out;
    },
  };
}
