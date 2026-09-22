import type { CommitFile } from '@gitifact/contracts';

interface Git { run(args: string[]): Promise<Buffer> }

/** Files a list returns; the rest are counted. A commit of thousands of files is read by its count, not scrolled. */
const LIST_LIMIT = 500;
/** A side larger than this is not sent: the browser compares lines itself, and a generated file says nothing read. */
const TEXT_LIMIT = 512 * 1024;
/** Commits kept in memory. A commit never changes, so its list is read once per server. */
const KEPT = 200;

export interface CommitFiles { commit: string; parent: string | null; total: number; files: CommitFile[] }
export interface CommitFileText { file: CommitFile; before: string | null; after: string | null; binary: boolean; tooLarge: boolean }

const statusOf = (code: string): CommitFile['status'] => code.startsWith('R') ? 'renamed' : code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified';
/** Documents are shown as records; only the source beside them is listed here. */
const isSource = (path: string) => !path.startsWith('.gitifact/');

/**
 * The source files one commit changed against its first parent (the root commit against nothing), with line counts,
 * and one file's text on both sides. Git is asked twice for a list — names with status, then counts — and once per
 * side for a file; nothing is written to the cache, since the drawer asks for one commit at a time.
 */
export function createCommitFiles(git: Git) {
  const lists = new Map<string, Promise<CommitFiles | undefined>>();
  const text = async (args: string[]) => (await git.run(args)).toString('utf8');

  async function read(commit: string): Promise<CommitFiles | undefined> {
    // A commit this repository does not have is not found; any other failure below is a real read error.
    try { if ((await text(['cat-file', '-t', commit])).trim() !== 'commit') return undefined; } catch { return undefined; }
    const parent = (await text(['rev-list', '--parents', '-n', '1', commit, '--'])).trim().split(' ')[1] ?? null;
    const base = parent ? ['diff', '-M', '-z'] : ['diff-tree', '--root', '--no-commit-id', '-r', '-M', '-z'];
    const revs = parent ? [parent, commit] : [commit];
    const names = (await text([...base, '--name-status', ...revs, '--'])).split('\0');
    const counts = (await text([...base, '--numstat', ...revs, '--'])).split('\0');
    const lines = new Map<string, { additions: number | null; deletions: number | null }>();
    for (let i = 0; i < counts.length; i++) {
      const [added, deleted, path] = counts[i]!.split('\t');
      if (added === undefined || deleted === undefined) continue;
      const count = { additions: added === '-' ? null : Number(added), deletions: deleted === '-' ? null : Number(deleted) };
      // A rename carries an empty path and then the old and new paths as the next two fields.
      if (path === '') { lines.set(counts[i + 2]!, count); i += 2; } else if (path !== undefined) lines.set(path, count);
    }
    const files: CommitFile[] = [];
    for (let i = 0; i < names.length - 1; i++) {
      const code = names[i]!; if (!code) continue;
      const renamed = code.startsWith('R') || code.startsWith('C');
      const previousPath = renamed ? names[++i]! : undefined; const path = names[++i]!;
      if (!isSource(path) && (!previousPath || !isSource(previousPath))) continue;
      files.push({ path, ...(renamed && code.startsWith('R') ? { previousPath } : {}), status: statusOf(code), ...(lines.get(path) ?? { additions: null, deletions: null }) });
    }
    return { commit, parent, total: files.length, files };
  }

  async function list(commit: string): Promise<CommitFiles | undefined> {
    let pending = lists.get(commit);
    if (!pending) {
      pending = read(commit); lists.set(commit, pending);
      pending.catch(() => lists.delete(commit));
      if (lists.size > KEPT) lists.delete(lists.keys().next().value!);
    }
    return pending;
  }

  async function side(rev: string | null, path: string | undefined): Promise<Buffer | null> {
    if (!rev || !path) return null;
    return git.run(['cat-file', 'blob', `${rev}:${path}`]);
  }

  return {
    /** The first `LIST_LIMIT` source files and how many there are; undefined for a commit the repository lacks. */
    async files(commit: string): Promise<CommitFiles | undefined> {
      const all = await list(commit);
      return all && { ...all, files: all.files.slice(0, LIST_LIMIT) };
    },
    /** One listed file on both sides; undefined when the commit did not change that path. */
    async file(commit: string, path: string): Promise<CommitFileText | undefined> {
      const all = await list(commit);
      const file = all?.files.find(f => f.path === path);
      if (!all || !file) return undefined;
      const { parent } = all;
      const [before, after] = await Promise.all([
        side(file.status === 'added' ? null : parent, file.previousPath ?? file.path),
        side(file.status === 'deleted' ? null : commit, file.path),
      ]);
      const sides = [before, after].filter((b): b is Buffer => !!b);
      const tooLarge = sides.some(b => b.length > TEXT_LIMIT);
      // Git counts no lines for a binary file; a NUL or text that is not UTF-8 is treated the same way.
      const binary = !tooLarge && (file.additions === null || sides.some(b => b.subarray(0, 8000).includes(0) || !isUtf8(b)));
      const show = (b: Buffer | null) => tooLarge || binary || !b ? null : b.toString('utf8');
      return { file, before: show(before), after: show(after), binary, tooLarge };
    },
  };
}

function isUtf8(bytes: Buffer) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true; } catch { return false; }
}
