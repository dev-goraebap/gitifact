import { InvalidArgumentError } from 'commander';
import { CommandError, text, type Format } from './output.js';
import type { Project } from './project.js';
import { t } from '../shared/i18n/index.js';

/** The options every `list` takes, with the same meaning in each resource. */
export interface ListOptions { format: Format; q?: string; author?: string; limit?: number; all?: boolean; after?: string; fields?: string[] }

/** Commander parser for `--limit`: a positive whole number. */
export function parseLimit(value: string): number {
  if (!/^[1-9]\d{0,5}$/.test(value)) throw new InvalidArgumentError(t('list.limit'));
  return Number(value);
}
/** Commander parser for `--fields`: comma-separated column names, checked against the resource's columns later. */
export const parseFields = (value: string) => value.split(',').map(f => f.trim()).filter(Boolean);

/** The columns asked for, or undefined for the whole row; a column the resource does not have is refused. */
export function checkFields(fields: string[] | undefined, columns: readonly string[]): string[] | undefined {
  if (!fields) return undefined;
  const unknown = fields.filter(f => !columns.includes(f));
  if (unknown.length || !fields.length) throw new CommandError('INVALID_VALUE', t('list.unknownFields', { fields: unknown.join(', '), columns: columns.join(', ') }));
  return [...new Set(fields)];
}

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
export async function since(project: Project, value: string | undefined, head: string | null): Promise<(change: Change) => boolean> {
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
export async function sinceRange(project: Project, value: string | undefined, head: string | null): Promise<{ from?: number; commits?: string[] }> {
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

/** One value of a row as a text cell: references by ID, the latest change as date, commit and author. */
function cell(value: unknown): string {
  if (value === undefined || value === null || value === false) return '';
  if (Array.isArray(value)) return value.map(v => typeof v === 'object' && v !== null ? ('id' in v ? v.id : 'title' in v ? v.title : JSON.stringify(v)) : String(v)).join(',');
  if (typeof value === 'object') {
    if ('commit' in value && 'date' in value) { const c = value as Change; return `${c.date.slice(0, 10)} ${c.commit.slice(0, 7)} ${c.author}`; }
    return JSON.stringify(value);
  }
  return String(value).replace(/[\t\n]+/g, ' ');
}

/** The rows with only the columns asked for: tab-separated lines in text, objects of those keys in JSON. */
export function selected<T extends Record<string, unknown>>(rows: T[], fields: string[]) {
  return {
    json: rows.map(row => Object.fromEntries(fields.map(f => [f, row[f] ?? null]))),
    text: rows.length ? text(rows.map(row => fields.map(f => cell(row[f])).join('\t'))) : '',
  };
}

/** How many items a list shows when neither `--limit` nor `--all` is given. */
export const PAGE_SIZE = 20;
/** One page of a list: the items shown, how many there are in all, and where the next page starts (null at the end). */
export interface Page<T> { rows: T[]; total: number; next: string | null }

/**
 * One page of rows already in list order. The cursor is the key of the last item shown, so the next page starts
 * after that item even if items before it came or went; a key that is no longer listed is refused, and the list is
 * read again from the start. `--all` shows every item.
 */
export function paginate<T>(rows: readonly T[], keyOf: (row: T) => string, options: Pick<ListOptions, 'after' | 'limit' | 'all'>): Page<T> {
  let start = 0;
  if (options.after !== undefined) {
    const at = rows.findIndex(row => keyOf(row) === options.after);
    if (at < 0) throw new CommandError('INVALID_VALUE', t('list.after', { cursor: options.after }));
    start = at + 1;
  }
  const size = options.all ? rows.length : options.limit ?? PAGE_SIZE;
  const shown = rows.slice(start, start + size);
  const more = start + shown.length < rows.length && shown.length > 0;
  return { rows: shown, total: rows.length, next: more ? keyOf(shown[shown.length - 1]!) : null };
}
/** The last line of a page that is not the end: how many are shown of how many, and the option that reads on. */
export const pageLine = (page: Page<unknown>, before = 0, unit = t('list.items')) =>
  page.next === null ? [] : [t('list.more', { shown: before + page.rows.length, total: page.total, unit, cursor: page.next })];
/**
 * Lines beside a tab-separated `--fields` answer: stdout keeps the rows only, so the line that says more pages follow
 * goes to stderr, where a person running the command still sees it. Adds nothing to stdout.
 */
export function aside(format: Format, lines: string[]): '' {
  if (format === 'text' && lines.length) process.stderr.write(lines.join('\n') + '\n');
  return '';
}
