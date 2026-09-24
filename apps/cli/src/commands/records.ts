import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docIdPattern, parseRecordFile, recordDayOf, recordPathOf, renderRecordFile, recordIdPattern, RECORD_ID_PREFIX, RECORD_REQUIRED_SECTIONS, RECORD_SECTION_HEADINGS,
  type DecisionRecord, type RecordSectionKey } from '@gitifact/core';
import { createDocumentFile, generateId } from '../adapters/filesystem/document-file.js';
import { findRecord } from '../adapters/git/pending-records.js';
import { byAuthor, checkFields, contains, selected, since, type ListOptions } from './list-options.js';
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

/** Record sections named in the CLI language, whatever language their headings were written in. */
const sectionLabel: Record<RecordSectionKey, () => string> = {
  context: () => t('records.section.context'), decision: () => t('records.section.decision'), alternatives: () => t('records.section.alternatives'),
};
const recordColumns = ['id', 'title', 'commit', 'date', 'author', 'docs', 'sections'] as const;
const eventColumns = ['commit', 'date', 'author', 'types', 'path', 'records', 'message'] as const;

/**
 * `records list`: the records of HEAD's history, newest first, after the ones not committed yet. With `--doc`, the
 * decision flow of one document instead: each commit that changed it with the records that explain it, and a change
 * a record should have explained says it has none.
 */
export const runRecordsList = (options: ListOptions & { doc?: string; since?: string }) => runCommand('records', options.format, async () => {
  const fields = checkFields(options.fields, options.doc === undefined ? recordColumns : eventColumns);
  const project = await openProject(process.cwd());
  const head = await project.head();
  const after = await since(project, options.since, head); const by = byAuthor(options.author); const has = contains(options.q);
  const limit = <T>(rows: T[]) => options.limit === undefined ? rows : rows.slice(0, options.limit);
  const sectionText = (sections: { body: string }[]) => sections.map(s => s.body);

  if (options.doc !== undefined) {
    const id = options.doc;
    const events = head ? await project.cache.history.ofDocument(head, id) : [];
    const { documents } = await project.cache.documents.list();
    const title = documents.find(d => d.id === id)?.title ?? events.map(e => (e.after ?? e.before)?.title).find(Boolean) ?? null;
    if (!title && !events.length) throw new CommandError('UNKNOWN_DOCUMENT', t('docs.unknownDocument', { ids: id }));
    const rows = limit(events.filter(e => after(e) && by(e) && has(e.message, ...e.records.flatMap(r => [r.title, ...sectionText(r.sections)]))).map(e => ({
      commit: e.commit, date: e.date, author: e.author, email: e.email, message: e.message, types: e.types, path: (e.after ?? e.before)?.path ?? null, records: e.records })));
    if (fields) { const picked = selected(rows, fields); return { json: { doc: { id, title }, events: picked.json }, text: picked.text }; }
    const out = [`${id} ${title ?? ''}`.trimEnd()];
    for (const e of rows) {
      out.push('', `${e.date.slice(0, 10)} ${e.commit.slice(0, 7)} ${e.types.join(',')} — ${e.author}`);
      for (const r of e.records) {
        out.push(`  ${r.id} ${r.title}`);
        out.push(...r.sections.map(s => '    ' + sectionLabel[s.key]() + ': ' + s.body.replace(/\s*\n\s*/g, ' ')));
      }
      if (!e.records.length && e.types.some(type => type !== 'created')) out.push('  ' + t('docs.noRecord'));
      out.push('  ' + t('docs.commit') + ': ' + e.message);
    }
    if (!rows.length) out.push(events.length ? t('docs.noMatch') : t('docs.noHistory'));
    return { json: { doc: { id, title }, events: rows }, text: text(out) };
  }

  // Records not committed yet have no commit, author or date: they come first and only while no author is asked for.
  const pending = options.author !== undefined ? [] : [...(await project.pendingRecords()).files].flatMap(([path, source]) => {
    try { return [parseRecordFile(path, source)]; } catch { return []; }
  }).map(r => ({ id: r.id, title: r.title, commit: null, date: null, author: null, docs: r.docs, sections: r.sections.map(s => ({ key: s.key, body: s.body })) }));
  const committed = (head ? await project.cache.history.recordsOf(head) : []).filter(r => after(r) && by(r) && has(r.title, r.message, ...sectionText(r.sections)))
    .map(r => ({ id: r.id, title: r.title, commit: r.commit, date: r.date, author: r.author, docs: r.docs, sections: r.sections }));
  const rows = limit([...pending.filter(r => has(r.title, ...sectionText(r.sections))).sort((a, b) => a.id < b.id ? -1 : 1), ...committed]);
  if (fields) { const picked = selected(rows, fields); return { json: { records: picked.json }, text: picked.text }; }
  // A record that explains many documents names the first few; JSON and --fields docs carry them all.
  const docs = (ids: string[]) => ids.slice(0, 5).join(', ') + (ids.length > 5 ? ' ' + t('records.moreDocs', { count: ids.length - 5 }) : '');
  const out = rows.flatMap(r => [`${r.id} ${r.title}`,
    `  ${r.commit ? `${r.date!.slice(0, 10)} ${r.commit.slice(0, 7)} ${r.author}` : t('records.uncommitted')} · ${docs(r.docs)}`]);
  const filtered = options.since !== undefined || options.author !== undefined || options.q !== undefined;
  return { json: { records: rows }, text: text(out.length ? out : [filtered ? t('docs.noMatch') : t('records.empty')]) };
});
