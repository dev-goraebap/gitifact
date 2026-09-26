import { CommandError } from '../commands/output.js';
import type { StoreReader } from '../adapters/git/store-reader.js';
import { t } from '../shared/i18n/index.js';

/** What a history filter reads a commit name through. */
type Resolving = { reader: Pick<StoreReader, 'resolve' | 'run' | 'decode'> };

export interface Change { commit: string; date: string; author: string; email: string }

/** Whether a change was made by the author named: the Git name or email, ignoring case. */
export function byAuthor(author: string | undefined): (change: Change) => boolean {
  if (author === undefined) return () => true;
  const wanted = author.trim().toLowerCase();
  return change => change.author.toLowerCase() === wanted || change.email.toLowerCase() === wanted;
}

/**
 * Whether a change came after a date or a commit. A value starting with YYYY-MM-DD is a date and counts from that
 * moment (midnight UTC for a bare day); anything else is a commit, and the changes after it are those of `<commit>..HEAD`.
 */
export async function since(project: Resolving, value: string | undefined, head: string | null): Promise<(change: Change) => boolean> {
  if (value === undefined) return () => true;
  if (/^\d{4}-\d\d-\d\d/.test(value)) {
    const from = Date.parse(value);
    if (!Number.isFinite(from)) throw new CommandError('INVALID_VALUE', t('list.since', { value }));
    return change => Date.parse(change.date) >= from;
  }
  let commit: string;
  try { commit = await project.reader.resolve(value); } catch { throw new CommandError('INVALID_VALUE', t('list.since', { value })); }
  if (!head) return () => false;
  const after = new Set(project.reader.decode(await project.reader.run(['rev-list', `${commit}..${head}`, '--'])).split('\n').filter(Boolean));
  return change => after.has(change.commit);
}

/**
 * The same `--since` as a filter the cache applies in SQL: a first moment for a date, or the commits of `<commit>..HEAD`.
 */
export async function sinceRange(project: Resolving, value: string | undefined, head: string | null): Promise<{ from?: number; commits?: string[] }> {
  if (value === undefined) return {};
  if (/^\d{4}-\d\d-\d\d/.test(value)) {
    const from = Date.parse(value);
    if (!Number.isFinite(from)) throw new CommandError('INVALID_VALUE', t('list.since', { value }));
    return { from };
  }
  let commit: string;
  try { commit = await project.reader.resolve(value); } catch { throw new CommandError('INVALID_VALUE', t('list.since', { value })); }
  if (!head) return { commits: [] };
  return { commits: project.reader.decode(await project.reader.run(['rev-list', `${commit}..${head}`, '--'])).split('\n').filter(Boolean) };
}

/** Case-insensitive containment, for the filters that run over text the cache does not index. */
export const contains = (query: string | undefined) => {
  const wanted = query?.trim().toLowerCase();
  return (...texts: (string | undefined)[]) => !wanted || texts.some(value => value?.toLowerCase().includes(wanted));
};
