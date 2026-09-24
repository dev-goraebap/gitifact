import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docIdPattern, parseRecordFile, recordDayOf, recordPathOf, renderRecordFile, recordIdPattern, RECORD_ID_PREFIX, RECORD_REQUIRED_SECTIONS, RECORD_SECTION_HEADINGS,
  type DecisionRecord } from '@gitifact/core';
import { createDocumentFile, generateId } from '../adapters/filesystem/document-file.js';
import { findRecord } from '../adapters/git/pending-records.js';
import { CommandError, runCommand, text, type Format } from './output.js';
import { openProject } from './project.js';
import { getLanguage, t } from '../shared/i18n/index.js';

type Options = { format: Format };

/**
 * `records new`: issues an ID and writes a draft record in today's folder with the sections every record needs,
 * headed in the CLI language. The record is written when the decision is made; `changes commit` refuses it until the
 * author has filled it in and removed `draft: true`.
 */
export const runRecordsNew = (options: Options & { title: string; docs: string[] }) => runCommand('records', options.format, async () => {
  if (/[\r\n]/.test(options.title)) throw new CommandError('INVALID_VALUE', t('docs.singleLine', { field: 'title' }));
  const docs = [...new Set(options.docs.flatMap(d => d.split(',')).map(d => d.trim()).filter(Boolean))];
  if (!docs.length || docs.some(d => !docIdPattern.test(d))) throw new CommandError('INVALID_VALUE', t('records.invalidDocs'));
  const project = await openProject(process.cwd());
  let id: string; do id = generateId(RECORD_ID_PREFIX); while (await findRecord(project.root, id));
  const lang = getLanguage();
  const record: DecisionRecord = { id, path: recordPathOf(id, recordDayOf(new Date())), title: options.title.trim(), docs, draft: true,
    sections: RECORD_REQUIRED_SECTIONS.map(key => ({ key, heading: RECORD_SECTION_HEADINGS[key][lang], body: t('records.skeleton') })) };
  const rendered = renderRecordFile(record);
  // The same parser as every later read decides whether the title and documents are acceptable.
  parseRecordFile(record.path, rendered);
  try { await createDocumentFile(project.root, record.path, rendered); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new CommandError('DOCUMENT_EXISTS', t('docs.exists', { path: record.path }));
    throw error;
  }
  return { json: { id, path: record.path }, text: text([t('docs.created', { id, path: record.path }), t('records.createdNext')]) };
});

/** `records show`: each record file as written, with the commit that added it; a record not yet committed says so. */
export const runRecordsShow = (ids: string[], options: Options) => runCommand('records', options.format, async () => {
  const bad = ids.filter(id => !recordIdPattern.test(id));
  if (bad.length) throw new CommandError('UNKNOWN_RECORD', t('records.unknown', { ids: bad.join(', ') }));
  const project = await openProject(process.cwd());
  const shown = await Promise.all([...new Set(ids)].map(async id => {
    const path = await findRecord(project.root, id);
    if (!path) return { id, missing: true as const };
    const source = await readFile(join(project.root, ...path.split('/')), 'utf8');
    const log = project.reader.decode(await project.reader.run(['log', '-1', '--diff-filter=A', '--format=%H%x00%aN%x00%aI', '--', path])).trim();
    const [commit, author, date] = log.split('\0');
    return { id, path, text: source, commit: commit ? { commit, author: author!, date: date! } : null };
  }));
  const missing = shown.filter(s => 'missing' in s).map(s => s.id);
  if (missing.length) throw new CommandError('UNKNOWN_RECORD', t('records.unknown', { ids: missing.join(', ') }));
  const found = shown.filter((s): s is Exclude<typeof s, { missing: true }> => !('missing' in s));
  const blocks = found.map(r => [
    `== ${r.id} ${r.path} (${r.commit ? `${r.commit.commit.slice(0, 7)} · ${r.commit.author} · ${r.commit.date.slice(0, 10)}` : t('records.uncommitted')})`,
    r.text.replace(/\n$/, ''),
  ].join('\n'));
  return { json: { records: found }, text: blocks.join('\n\n') + '\n' };
});
