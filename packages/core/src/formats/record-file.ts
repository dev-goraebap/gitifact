import { DocumentError, docIdPattern, recordIdPattern } from '../domain/document.js';
import { RECORD_REQUIRED_SECTIONS, RECORD_SECTION_HEADINGS, RECORD_SECTION_LIMIT, RECORD_TITLE_LIMIT, recordSectionKeys,
  type DecisionRecord, type RecordSection, type RecordSectionKey } from '../domain/record.js';
import { parseFrontmatterBlock, renderFrontmatterBlock } from './frontmatter.js';
import { t } from '../shared/i18n/index.js';

//   .gitifact/records/<yyyymmdd>/<DR-ID>.md   one decision record; the folder is the day it was written, the file name its ID
export const RECORDS_ROOT = '.gitifact/records';
const day = '\\d{4}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])';
const recordPath = new RegExp(`^\\.gitifact/records/(${day})/(DR-[a-z2-7]{10})\\.md$`);
const dayFolder = new RegExp(`^${day}$`);
const KEYS = ['id', 'title', 'docs', 'draft'];

/** Whether a repository path is where a record lives. */
export const isRecordPath = (path: string) => recordPath.test(path);
/** Whether a folder name under `.gitifact/records` is a day (yyyymmdd). */
export const isRecordFolder = (name: string) => dayFolder.test(name);
/** The day folder of a date, in the writer's own time zone: a folder exists only for days a record was written. */
export const recordDayOf = (date: Date) => String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
/** Where a new record is written: the folder of the day it is written. */
export const recordPathOf = (id: string, day: string) => `${RECORDS_ROOT}/${day}/${id}.md`;
/** The ID a record path names. */
export const recordIdOf = (path: string) => recordPath.exec(path)?.[2];

/** The section key a heading names, in either language; headings compare without case or surrounding space. */
export function sectionKeyOf(heading: string): RecordSectionKey | undefined {
  const name = heading.trim().toLowerCase();
  return recordSectionKeys.find(key => RECORD_SECTION_HEADINGS[key].ko === name || RECORD_SECTION_HEADINGS[key].en.toLowerCase() === name);
}
const nameOf = (key: RecordSectionKey) => RECORD_SECTION_HEADINGS[key].ko + ' / ' + RECORD_SECTION_HEADINGS[key].en;

/**
 * The body is `## ` sections only, each a known one and none twice. Nothing stands before the first
 * section; `#` titles and gitifact comments are refused as in documents; headings inside fenced code are text.
 */
function sections(raw: string, path: string): RecordSection[] {
  const found: { key: RecordSectionKey; heading: string; lines: string[] }[] = [];
  const unknown = (section: string) => new DocumentError('RECORD_SECTION_UNKNOWN', path, t('doc.RECORD_SECTION_UNKNOWN', { path, section }));
  let fence: { char: string; size: number } | undefined;
  for (const line of raw.split('\n')) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined;
      found.at(-1)?.lines.push(line); continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) fence = { char: open[1]![0]!, size: open[1]!.length };
    else if (/^#\s/.test(line)) throw new DocumentError('BODY_HEADING', path, t('doc.BODY_HEADING', { path }));
    else if (/<!-- gitifact-/.test(line)) throw new DocumentError('BODY_MARKER', path, t('doc.BODY_MARKER', { path }));
    const heading = !open && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const key = sectionKeyOf(heading[1]!);
      if (!key || found.some(s => s.key === key)) throw unknown(heading[1]!);
      found.push({ key, heading: heading[1]!.trim(), lines: [] });
      continue;
    }
    if (!found.length) { if (line.trim()) throw unknown(line.trim().slice(0, 40)); continue; }
    found.at(-1)!.lines.push(line);
  }
  if (fence) throw new DocumentError('BODY_UNCLOSED_FENCE', path, t('doc.BODY_UNCLOSED_FENCE', { path }));
  const result = found.map(s => ({ key: s.key, heading: s.heading, body: s.lines.join('\n').trim() }));
  for (const key of RECORD_REQUIRED_SECTIONS) {
    if (!result.some(s => s.key === key && s.body)) throw new DocumentError('RECORD_SECTION_MISSING', path, t('doc.RECORD_SECTION_MISSING', { path, section: nameOf(key) }));
  }
  for (const s of result) {
    const length = [...s.body].length;
    if (!s.body) throw new DocumentError('RECORD_SECTION_MISSING', path, t('doc.RECORD_SECTION_MISSING', { path, section: s.heading }));
    if (length > RECORD_SECTION_LIMIT) throw new DocumentError('RECORD_SECTION_TOO_LONG', path, t('doc.RECORD_SECTION_TOO_LONG', { path, section: s.heading, length, limit: RECORD_SECTION_LIMIT }));
  }
  return result;
}

/** Reads one record file. Throws DocumentError for the first problem; `checkDocuments` collects them per file. */
export function parseRecordFile(path: string, source: string): DecisionRecord {
  const where = recordPath.exec(path);
  if (!where) throw new DocumentError('PATH_UNSUPPORTED', path, t('doc.PATH_UNSUPPORTED', { path }));
  if (source.includes('\0') || /\r(?!\n)/.test(source) || source.charCodeAt(0) === 0xfeff) throw new DocumentError('INVALID_CHARACTERS', path, t('doc.INVALID_CHARACTERS', { path }));
  const { fields, body } = parseFrontmatterBlock(source.replace(/\r\n/g, '\n'), path);
  for (const key of fields.keys()) if (!KEYS.includes(key)) throw new DocumentError('FRONTMATTER_UNKNOWN_KEY', path, t('doc.FRONTMATTER_UNKNOWN_KEY', { path, key }));
  for (const key of ['id', 'title', 'docs']) if (!fields.has(key)) throw new DocumentError('FRONTMATTER_MISSING_KEY', path, t('doc.FRONTMATTER_MISSING_KEY', { path, key }));
  const value = (key: string) => { const field = fields.get(key); return field?.type === 'scalar' ? field.value : undefined; };
  const id = value('id');
  if (!id || !recordIdPattern.test(id)) throw new DocumentError('ID_FORMAT', path, t('doc.ID_FORMAT', { path, kind: 'record' }));
  if (id !== where[2]) throw new DocumentError('RECORD_PATH', path, t('doc.RECORD_PATH', { path, id }));
  const title = value('title')?.trim();
  if (!title || [...title].length > RECORD_TITLE_LIMIT || /[\r\n\0]/.test(title)) throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: 'title' }));
  const docs = fields.get('docs');
  if (docs?.type !== 'list' || !docs.items.length || docs.items.some(d => !docIdPattern.test(d)) || new Set(docs.items).size !== docs.items.length) {
    throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: 'docs' }));
  }
  const draft = fields.get('draft');
  if (draft && (draft.type !== 'scalar' || draft.value !== 'true')) throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: 'draft' }));
  return { id, path, title, docs: docs.items, sections: sections(body.trim(), path), ...(draft ? { draft: true as const } : {}) };
}

/** Canonical text of a record: frontmatter in a fixed key order (a draft mark last), then its sections. */
export function renderRecordFile(record: DecisionRecord): string {
  const front = renderFrontmatterBlock([['id', record.id], ['title', record.title], ['docs', record.docs], ['draft', record.draft ? true : undefined]]);
  return `${front}\n\n${record.sections.map(s => `## ${s.heading}\n\n${s.body}`).join('\n\n')}\n`;
}
