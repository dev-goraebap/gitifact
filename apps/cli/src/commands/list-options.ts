import { InvalidArgumentError } from 'commander';
import { CommandError, text, type Format } from './output.js';
import type { Project } from './project.js';
import { t } from '../shared/i18n/index.js';

/** The options every `list` takes, with the same meaning in each resource. */
export interface ListOptions { format: Format; q?: string; author?: string; limit?: number; fields?: string[] }

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
