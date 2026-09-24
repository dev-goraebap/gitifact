import { arrangeDocuments, type FeatureDoc } from '@gitifact/core';
import { createDocument, draftMark, line, showDocuments, titledSources } from './documents.js';
import { byAuthor, checkFields, selected, since, type Change, type ListOptions } from './list-options.js';
import { CommandError, runCommand, section, text, type Format } from './output.js';
import { openProject } from './project.js';
import { t } from '../shared/i18n/index.js';

export const specKinds = ['feature', 'requirement', 'design'] as const;
export const specSorts = ['order', 'title', 'updated'] as const;
type SpecKind = typeof specKinds[number];
const columns = ['id', 'kind', 'feature', 'path', 'title', 'description', 'order', 'draft', 'requirements', 'sources', 'designs', 'updated', 'line'] as const;

export type SpecsListOptions = ListOptions & {
  type?: SpecKind; feature?: string; withoutDesign?: boolean; uncovered?: boolean; draft?: boolean; changedSince?: string; sort: typeof specSorts[number];
};
type Titled = { id: string; title: string | null };
const kindLabel: Record<SpecKind, () => string> = { feature: () => t('docs.feature'), requirement: () => t('docs.requirement'), design: () => t('docs.design') };

/**
 * `specs list`: features, requirements and designs without their bodies, one row per document. The filters pick rows
 * by relation (designs and the requirements they cover), by state (drafts) and by history (who changed what since
 * when). History is read only when an option needs it, so a plain list never walks the commits.
 */
export const runSpecsList = (options: SpecsListOptions) => runCommand('specs', options.format, async () => {
  const fields = checkFields(options.fields, columns);
  const project = await openProject(process.cwd());
  const { documents, problems } = await project.cache.documents.list();
  const byId = new Map(documents.map(d => [d.id, d]));
  const arranged = arrangeDocuments(documents);
  let features = arranged.features;
  if (options.feature !== undefined) {
    features = features.filter(f => f.index.feature === options.feature);
    if (!features.length) throw new CommandError('UNKNOWN_FEATURE', t('docs.unknownFeature', { feature: options.feature }));
  }
  const titled = (id: string): Titled => ({ id, title: byId.get(id)?.title ?? null });
  const designsOf = new Map<string, Titled[]>();
  for (const f of arranged.features) for (const d of f.designs) for (const r of d.requirements) designsOf.set(r, [...designsOf.get(r) ?? [], titled(d.id)]);

  const historyNeeded = options.sort === 'updated' || options.changedSince !== undefined || options.author !== undefined || !!fields?.includes('updated');
  const latest = new Map<string, Change>();
  // Each document's place in HEAD's history, newest first: the order of commits, not their dates, which may tie.
  const newest = new Map<string, number>();
  let touched: Set<string> | undefined;
  if (historyNeeded) {
    const head = await project.head();
    const changes = head ? await project.cache.history.changesOf(head) : [];
    changes.forEach((c, rank) => { if (!latest.has(c.id)) { latest.set(c.id, { commit: c.commit, date: c.date, author: c.author, email: c.email }); newest.set(c.id, rank); } });
    if (options.changedSince !== undefined || options.author !== undefined) {
      const after = await since(project, options.changedSince, head); const by = byAuthor(options.author);
      touched = new Set(changes.filter(c => after(c) && by(c)).map(c => c.id));
    }
  }
  const matched = options.q !== undefined ? await project.cache.documents.matching(options.q) : undefined;

  const rows = features.flatMap(f => [f.index, ...f.requirements, ...f.designs].filter(doc =>
    (options.type === undefined || doc.kind === options.type)
    && (!options.withoutDesign || !f.designs.length)
    && (!options.uncovered || (doc.kind === 'requirement' && !designsOf.has(doc.id)))
    && (!options.draft || doc.draft)
    && (!touched || touched.has(doc.id))
    && (!matched || matched.has(doc.id)),
  ).map(doc => ({
    id: doc.id, kind: doc.kind as SpecKind, feature: (doc as FeatureDoc).feature, path: doc.path, title: doc.title, description: doc.description,
    ...(doc.kind === 'requirement' || doc.kind === 'design' ? { order: doc.order } : {}),
    ...(doc.draft ? { draft: true } : {}),
    ...(doc.kind === 'design' ? { requirements: doc.requirements.map(titled), sources: titledSources(doc, byId) } : {}),
    ...(doc.kind === 'requirement' ? { designs: designsOf.get(doc.id) ?? [] } : {}),
    ...(historyNeeded ? { updated: latest.get(doc.id) ?? null } : {}),
    ...(matched ? { line: matched.get(doc.id)! } : {}),
  })));
  type Row = typeof rows[number];
  if (options.sort === 'title') rows.sort((a, b) => a.title.localeCompare(b.title));
  // Newest change first; a document history has never seen (a new file) goes last.
  if (options.sort === 'updated') rows.sort((a, b) => (newest.get(a.id) ?? Infinity) - (newest.get(b.id) ?? Infinity));
  const shown = options.limit === undefined ? rows : rows.slice(0, options.limit);
  const orphans = options.feature === undefined ? arranged.orphans : [];

  if (fields) {
    const picked = selected(shown, fields);
    return { json: { documents: picked.json, orphans, problems }, text: picked.text };
  }
  const refName = (r: Titled) => r.id + ' ' + (r.title ?? '(' + t('docs.missing') + ')');
  const excerpt = (row: Row) => row.line ? ['  ' + row.line] : [];
  const out: string[] = [];
  if (options.sort === 'order') {
    // Grouped by feature, so every row is read with the feature it belongs to, even when the feature row was filtered out.
    for (const f of features) {
      const own = shown.filter(r => r.feature === f.index.feature);
      if (!own.length) continue;
      out.push(`[${t('docs.feature')}] ${f.index.id} ${f.index.title}${draftMark(f.index)} (${f.index.feature}) — ${f.index.description}`);
      const index = own.find(r => r.kind === 'feature');
      if (index) out.push(...excerpt(index));
      const requirement = (r: Row) => [`${r.order} ${line(byId.get(r.id)!)}`, ...excerpt(r)];
      out.push(...section('  ' + t('docs.requirements'), own.filter(r => r.kind === 'requirement').flatMap(requirement), '    '));
      const designs = own.filter(r => r.kind === 'design').flatMap(r => {
        const refs = r.requirements!.length ? ' [' + r.requirements!.map(refName).join(', ') + ']' : '';
        const notes = r.sources!.map(s => 'id' in s ? refName(s as Titled) : s.title);
        return [`${r.order} ${line(byId.get(r.id)!)}${refs}`, ...(notes.length ? [' '.repeat(String(r.order).length + 1) + t('docs.sources') + ': ' + notes.join(', ')] : []), ...excerpt(r)];
      });
      out.push(...section('  ' + t('docs.designs'), designs, '    '));
    }
  } else {
    for (const r of shown) {
      const when = r.updated ? ` · ${r.updated.date.slice(0, 10)} ${r.updated.author}` : '';
      out.push(`${r.id} ${r.title}${draftMark(r as { draft?: true })} (${kindLabel[r.kind]()} · ${r.feature}) — ${r.description}${when}`, ...excerpt(r));
    }
  }
  const filtered = options.type !== undefined || options.feature !== undefined || options.withoutDesign || options.uncovered || options.draft
    || options.changedSince !== undefined || options.author !== undefined || options.q !== undefined;
  if (!out.length) out.push(filtered ? t('docs.noMatch') : t('docs.empty'));
  if (orphans.length) out.push(t('docs.orphans', { folders: orphans.join(', ') }));
  if (problems.length) out.push(t('docs.unreadable', { count: problems.length }));
  return { json: { documents: shown, orphans, problems }, text: text(out) };
});

/** `specs show`: features, requirements and designs as written, with their references both ways. */
export const runSpecsShow = (ids: string[], options: { format: Format; ref?: string }) => runCommand('specs', options.format, async () => {
  const project = await openProject(process.cwd());
  const at = options.ref === undefined ? undefined : await project.reader.resolve(options.ref);
  return showDocuments(project, ids, at, specKinds, 'instructions show');
});

/** `specs new <kind> <path>`: a feature, requirement or design with an issued ID and a draft skeleton. */
export const runSpecsNew = (kind: SpecKind, path: string, options: { format: Format; title: string; description: string }) => runCommand('specs', options.format, async () =>
  createDocument(await openProject(process.cwd()), kind, path, options));

