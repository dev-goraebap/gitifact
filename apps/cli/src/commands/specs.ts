import { createDocument, draftMark, line, showDocuments, stateMark } from './documents.js';
import { listSpecs, type Titled } from '../queries/specs.js';
import { checkFields, aside, cursorGone, pageLine, selected, type ListOptions } from './list-options.js';
import { CommandError, runCommand, section, text, type Format } from './output.js';
import { openProject } from './project.js';
import { t } from '../shared/i18n/index.js';

export const specKinds = ['feature', 'requirement', 'design'] as const;
export const specSorts = ['order', 'title', 'updated'] as const;
type SpecKind = typeof specKinds[number];
const columns = ['id', 'kind', 'feature', 'path', 'title', 'description', 'order', 'draft', 'state', 'previousPath', 'requirements', 'sources', 'designs', 'updated', 'line'] as const;

export type SpecsListOptions = ListOptions & {
  type?: SpecKind; feature?: string; withoutDesign?: boolean; uncovered?: boolean; draft?: boolean; changedSince?: string; sort: typeof specSorts[number];
};
const kindLabel: Record<SpecKind, () => string> = { feature: () => t('docs.feature'), requirement: () => t('docs.requirement'), design: () => t('docs.design') };

/** `specs list`: the rows `queries/specs.ts` picks and pages, grouped by feature in feature order. */
export const runSpecsList = (options: SpecsListOptions) => runCommand('specs', options.format, async () => {
  const fields = checkFields(options.fields, columns);
  const project = await openProject(process.cwd());
  const listed = await listSpecs(project, { ...options, withUpdated: !!fields?.includes('updated') }, options) ?? cursorGone(options);
  const { rows: shown, features, byId, states, grouped, problems, orphans, page } = listed;
  type Row = typeof shown[number];
  const more = pageLine(page, 0, grouped ? t('list.features') : t('list.items'));
  const paging = { total: page.total, next: page.next, unit: listed.unit };

  if (fields) {
    const picked = selected(shown, fields);
    return { json: { documents: picked.json, orphans, problems, page: paging }, text: picked.text + aside(options.format, more) };
  }
  const refName = (r: Titled) => r.id + ' ' + (r.title ?? '(' + t('docs.missing') + ')');
  const excerpt = (row: Row) => row.line ? ['  ' + row.line] : [];
  const out: string[] = [];
  if (options.sort === 'order') {
    // Grouped by feature, so every row is read with the feature it belongs to, even when the feature row was filtered out.
    for (const f of features) {
      const own = shown.filter(r => r.feature === f.index.feature);
      if (!own.length) continue;
      out.push(`[${t('docs.feature')}] ${f.index.id} ${f.index.title}${draftMark(f.index)}${stateMark(states.state(f.index.id))} (${f.index.feature}) — ${f.index.description}`);
      const index = own.find(r => r.kind === 'feature');
      if (index) out.push(...excerpt(index));
      const requirement = (r: Row) => [`${r.order} ${line(byId.get(r.id)!)}${stateMark(r.state)}`, ...excerpt(r)];
      out.push(...section('  ' + t('docs.requirements'), own.filter(r => r.kind === 'requirement').flatMap(requirement), '    '));
      const designs = own.filter(r => r.kind === 'design').flatMap(r => {
        const refs = r.requirements!.length ? ' [' + r.requirements!.map(refName).join(', ') + ']' : '';
        const notes = r.sources!.map(s => 'id' in s ? refName(s as Titled) : s.title);
        return [`${r.order} ${line(byId.get(r.id)!)}${stateMark(r.state)}${refs}`, ...(notes.length ? [' '.repeat(String(r.order).length + 1) + t('docs.sources') + ': ' + notes.join(', ')] : []), ...excerpt(r)];
      });
      out.push(...section('  ' + t('docs.designs'), designs, '    '));
    }
  } else {
    for (const r of shown) {
      const when = r.updated ? ` · ${r.updated.date.slice(0, 10)} ${r.updated.author}` : '';
      out.push(`${r.id} ${r.title}${draftMark(r as { draft?: true })}${stateMark(r.state)} (${kindLabel[r.kind]()} · ${r.feature}) — ${r.description}${when}`, ...excerpt(r));
    }
  }
  const filtered = options.type !== undefined || options.feature !== undefined || options.withoutDesign || options.uncovered || options.draft
    || options.changedSince !== undefined || options.author !== undefined || options.q !== undefined;
  if (!out.length) out.push(filtered ? t('docs.noMatch') : t('docs.empty'));
  out.push(...more);
  if (orphans.length) out.push(t('docs.orphans', { folders: orphans.join(', ') }));
  if (problems.length) out.push(t('docs.unreadable', { count: problems.length }));
  return { json: { documents: shown, orphans, problems, page: paging }, text: text(out) };
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

