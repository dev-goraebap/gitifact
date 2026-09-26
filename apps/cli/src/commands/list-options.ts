import { InvalidArgumentError } from 'commander';
import { CommandError, text, type Format } from './output.js';
import { t } from '../shared/i18n/index.js';
import { pageOf, type Page, type PageRequest } from '../queries/paging.js';

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

export { byAuthor, contains, since, sinceRange, type Change } from '../queries/filters.js';
import type { Change } from '../queries/filters.js';

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

export { PAGE_SIZE, type Page } from '../queries/paging.js';

/** One page of rows already in list order (`queries/paging.ts`); a cursor that is no longer listed is refused. */
export function paginate<T>(rows: readonly T[], keyOf: (row: T) => string, options: PageRequest): Page<T> {
  return pageOr(pageOf(rows, keyOf, options), options);
}
/** A page a query answered, or the refusal of a cursor it did not find. */
export function pageOr<T>(page: Page<T> | undefined, options: PageRequest): Page<T> {
  return page ?? cursorGone(options);
}
/** Refuses a cursor the list no longer has: the list is read again from the start. */
export function cursorGone(options: PageRequest): never {
  throw new CommandError('INVALID_VALUE', t('list.after', { cursor: options.after ?? '' }));
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
