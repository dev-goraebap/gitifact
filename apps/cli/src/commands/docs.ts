import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkDocuments, classifyDocPath, arrangeDocuments, parseDocumentFile, renderDocumentFile, INSTRUCTION_FILE, INSTRUCTIONS_ROOT, SPEC_ROOT, WIKI_ROOT,
  type DesignDoc, type Doc, type DocKind, type DocProblem, type DocWarning } from '@gitifact/core';
import { createDocumentFile, generateId } from '../adapters/filesystem/document-file.js';
import { readDocumentWarnings } from '../adapters/filesystem/document-warnings.js';
import { listInstructionFiles } from '../adapters/filesystem/instruction-folder.js';
import { CommandError, runCommand, section, text, type CommandResult, type Format } from './output.js';
import { documentsOf, openProject, type Project } from './project.js';
import { t } from '../shared/i18n/index.js';

export const newKinds = ['feature', 'requirement', 'design', 'wiki', 'instruction'] as const satisfies readonly DocKind[];
type Options = { format: Format };

const draftMark = (doc: Doc) => doc.draft ? ' (' + t('docs.draft') + ')' : '';
/** The path people type and the viewer shows: inside `.gitifact`, without that prefix. */
const place = (path: string) => path.replace(/^\.gitifact\//, '');
const line = (doc: Doc) => `${doc.id} ${doc.title}${draftMark(doc)} — ${doc.description}`;
const problemLines = (problems: (DocProblem | DocWarning)[]) => problems.map(p => p.code + ' ' + p.message);

/** `docs list`: frontmatter only, with referenced documents named by title, never a body. */
export const runDocsList = (options: Options & { feature?: string; kind?: 'spec' | 'wiki' | 'instruction' }) => runCommand('docs', options.format, async () => {
  const project = await openProject(process.cwd());
  const { documents, problems } = await project.cache.documents.list();
  const byId = new Map(documents.map(d => [d.id, d]));
  const arranged = arrangeDocuments(documents);
  let features = options.kind === 'wiki' || options.kind === 'instruction' ? [] : arranged.features;
  if (options.feature !== undefined) {
    features = features.filter(f => f.index.feature === options.feature);
    if (!features.length) throw new CommandError('UNKNOWN_FEATURE', t('docs.unknownFeature', { feature: options.feature }));
  }
  const only = (kind: 'wiki' | 'instruction') => (options.kind === undefined || options.kind === kind) && options.feature === undefined;
  const wiki = only('wiki') ? arranged.wiki : [];
  const instructions = only('instruction') ? arranged.instructions : [];
  const titled = (id: string) => ({ id, title: byId.get(id)?.title ?? null });
  const sources = (d: DesignDoc) => d.sources.map(s => 'id' in s ? { ...titled(s.id), ...(s.note ? { note: s.note } : {}) } : s);
  const json = {
    features: features.map(f => ({
      id: f.index.id, feature: f.index.feature, path: f.index.path, title: f.index.title, description: f.index.description, ...(f.index.draft ? { draft: true } : {}),
      requirements: f.requirements.map(r => ({ id: r.id, path: r.path, order: r.order, title: r.title, description: r.description, ...(r.draft ? { draft: true } : {}) })),
      designs: f.designs.map(d => ({ id: d.id, path: d.path, order: d.order, title: d.title, description: d.description, ...(d.draft ? { draft: true } : {}),
        requirements: d.requirements.map(titled), sources: sources(d) })),
    })),
    wiki: wiki.map(w => ({ id: w.id, path: w.path, title: w.title, description: w.description, ...(w.draft ? { draft: true } : {}) })),
    instructions: instructions.map(k => ({ id: k.id, name: k.name, path: k.path, title: k.title, description: k.description, ...(k.draft ? { draft: true } : {}) })),
    orphans: options.feature === undefined && (options.kind === undefined || options.kind === 'spec') ? arranged.orphans : [],
    problems,
  };
  const named = (id: string) => id + ' ' + (byId.get(id)?.title ?? '(' + t('docs.missing') + ')');
  const out: string[] = [];
  for (const f of features) {
    out.push(`[${t('docs.feature')}] ${f.index.id} ${f.index.title}${draftMark(f.index)} (${f.index.feature}) — ${f.index.description}`);
    out.push(...section('  ' + t('docs.requirements'), f.requirements.map(r => `${r.order} ${line(r)}`), '    '));
    const designs = f.designs.flatMap(d => {
      const refs = d.requirements.length ? ' [' + d.requirements.map(named).join(', ') + ']' : '';
      const notes = d.sources.map(s => 'id' in s ? named(s.id) : s.title);
      return [`${d.order} ${line(d)}${refs}`, ...(notes.length ? [' '.repeat(String(d.order).length + 1) + t('docs.sources') + ': ' + notes.join(', ')] : [])];
    });
    out.push(...section('  ' + t('docs.designs'), designs, '    '));
  }
  if (wiki.length) out.push(`[${t('docs.wiki')}]`, ...wiki.map(w => `  ${w.id} ${w.title}${draftMark(w)} (${place(w.path).slice('wiki/'.length)}) — ${w.description}`));
  if (instructions.length) out.push(`[${t('docs.instructions')}]`, ...instructions.map(k => `  ${k.id} ${k.title}${draftMark(k)} (${k.name}) — ${k.description}`));
  if (!out.length) out.push(t('docs.empty'));
  if (json.orphans.length) out.push(t('docs.orphans', { folders: json.orphans.join(', ') }));
  if (problems.length) out.push(t('docs.unreadable', { count: problems.length }));
  return { json, text: text(out) };
});

/** `docs search`: documents whose title, place or text holds the words, best matches first, each with the line that matched. */
export const runDocsSearch = (query: string, options: Options) => runCommand('docs', options.format, async () => {
  const project = await openProject(process.cwd());
  const hits = await project.cache.search(null, query);
  const { documents } = await project.cache.documents.list();
  const byId = new Map(documents.map(d => [d.id, d]));
  const found = hits.flatMap(hit => { const doc = byId.get(hit.id); return doc ? [{ doc, line: hit.line }] : []; });
  const json = { query, hits: found.map(({ doc, line }) => ({ id: doc.id, kind: doc.kind, path: doc.path, title: doc.title, description: doc.description, line })) };
  const out = found.flatMap(({ doc, line: excerpt }) => [`${doc.id} ${doc.title}${draftMark(doc)} (${place(doc.path)}) — ${doc.description}`, '    ' + excerpt]);
  return { json, text: text(out.length ? out : [t('docs.noHits', { query })]) };
});

/**
 * `docs show`: each file exactly as it is, so an agent quotes and edits the same bytes, followed by the documents it
 * points at and the documents that point at it. With `--ref`, everything is read from that commit.
 */
export const runDocsShow = (ids: string[], options: Options & { ref?: string }) => runCommand('docs', options.format, async () => {
  const project = await openProject(process.cwd());
  const at = options.ref === undefined ? undefined : await project.reader.resolve(options.ref);
  const view = at === undefined ? await working(project) : await committed(project, at);
  const unknown = ids.filter(id => !view.byId.has(id));
  if (unknown.length) throw new CommandError('UNKNOWN_DOCUMENT', t('docs.unknownDocument', { ids: unknown.join(', ') }));
  const shown = await Promise.all([...new Set(ids)].map(async id => {
    const doc = view.byId.get(id)!;
    const references = doc.kind === 'design' ? [
      ...doc.requirements.map(r => ({ id: r, title: view.byId.get(r)?.title ?? null })),
      ...doc.sources.map(s => 'id' in s ? { id: s.id, title: view.byId.get(s.id)?.title ?? null } : { title: s.title, url: s.url }),
    ] : [];
    const referencedBy = (await view.referencing(id)).map(from => ({ id: from, title: view.byId.get(from)?.title ?? null }));
    // An instruction is its folder: agents read the files beside index.md when the instruction points at them.
    const files = doc.kind === 'instruction' && at === undefined ? { files: (await listInstructionFiles(project.root, doc.path)).files.map(f => f.path) } : {};
    return { id, kind: doc.kind, path: doc.path, title: doc.title, text: await view.read(doc.path), references, referencedBy, ...files };
  }));
  const named = (r: { id?: string; title: string | null; url?: string }) => r.id ? r.id + ' ' + (r.title ?? '(' + t('docs.missing') + ')') : r.title + ' <' + r.url + '>';
  const blocks = shown.map(d => [
    `== ${d.id} ${d.path}${at ? ' @ ' + at.slice(0, 7) : ''}`,
    d.text.replace(/\n$/, ''),
    ...section('-- ' + t('docs.references'), d.references.map(named)),
    ...section('-- ' + t('docs.referencedBy'), d.referencedBy.map(named)),
    ...section('-- ' + t('docs.files'), d.files ?? []),
  ].join('\n'));
  return { json: { ...(at ? { commit: at } : {}), documents: shown }, text: blocks.join('\n\n') + '\n' };
});

async function working(project: Project) {
  const { documents } = await project.cache.documents.list();
  return {
    byId: new Map(documents.map(d => [d.id, d])),
    read: (path: string) => readFile(join(project.root, ...path.split('/')), 'utf8'),
    referencing: async (id: string) => [...new Set((await project.cache.documents.referencing(id)).map(r => r.from))],
  };
}
async function committed(project: Project, commit: string) {
  const files = await project.cache.history.filesAt(commit);
  const documents = documentsOf(files);
  const byId = new Map(documents.map(d => [d.id, d]));
  return {
    byId,
    read: async (path: string) => files.get(path)!,
    referencing: async (id: string) => documents.filter(d => d.kind === 'design' && (d.requirements.includes(id) || d.sources.some(s => 'id' in s && s.id === id))).map(d => d.id),
  };
}

// Per kind: how its path is written, and the body `docs new` starts it with.
const pathExample: Record<typeof newKinds[number], () => string> = {
  feature: () => t('docs.pathExample.feature'), requirement: () => t('docs.pathExample.requirement'),
  design: () => t('docs.pathExample.design'), wiki: () => t('docs.pathExample.wiki'), instruction: () => t('docs.pathExample.instruction'),
};
const skeleton: Record<typeof newKinds[number], () => string> = {
  feature: () => t('docs.skeleton.feature'), requirement: () => t('docs.skeleton.requirement'),
  design: () => t('docs.skeleton.design'), wiki: () => t('docs.skeleton.wiki'), instruction: () => t('docs.skeleton.instruction'),
};

/** Where `docs new <kind> <path>` puts a document: a feature folder, a requirement or design slug in one, a wiki page or an instruction folder. */
function newPath(kind: typeof newKinds[number], path: string): string {
  const target = kind === 'feature' ? `${SPEC_ROOT}/${path}/index.md`
    : kind === 'wiki' ? `${WIKI_ROOT}/${path.endsWith('.md') ? path : path + '.md'}`
    : kind === 'instruction' ? `${INSTRUCTIONS_ROOT}/${path}/${INSTRUCTION_FILE}`
    : `${SPEC_ROOT}/${path.split('/')[0]}/${kind === 'requirement' ? 'requirements' : 'design'}/${path.split('/').slice(1).join('/')}.md`;
  const shape = kind === 'feature' || kind === 'instruction' ? /^[^/]+$/ : kind === 'wiki' ? /./ : /^[^/]+\/[^/]+$/;
  let where; try { where = shape.test(path) ? classifyDocPath(target) : undefined; } catch { where = undefined; }
  if (where?.type !== 'doc' || where.kind !== kind) throw new CommandError('INVALID_PATH', t('docs.invalidPath', { kind, path, example: pathExample[kind]() }));
  return target;
}

/**
 * `docs new`: issues the ID, fills the frontmatter and writes a skeleton body with `draft: true`, which the check
 * refuses until the author has written the document and removed the line.
 */
export const runDocsNew = (kind: typeof newKinds[number], path: string, options: Options & { title: string; description: string }) => runCommand('docs', options.format, async () => {
  for (const [field, value] of [['title', options.title], ['description', options.description]] as const) {
    if (/[\r\n]/.test(value)) throw new CommandError('INVALID_VALUE', t('docs.singleLine', { field }));
  }
  const project = await openProject(process.cwd());
  const target = newPath(kind, path);
  const { documents } = await project.cache.documents.list();
  const taken = new Set(documents.map(d => d.id));
  let id: string; do id = generateId(({ feature: 'S', requirement: 'R', design: 'D', wiki: 'W', instruction: 'I' } as const)[kind]); while (taken.has(id));
  const folder = target.slice(0, target.lastIndexOf('/') + 1);
  const siblings = documents.filter(d => (d.kind === 'requirement' || d.kind === 'design') && d.path.startsWith(folder) && !d.path.slice(folder.length).includes('/'));
  const order = Math.min(999999, Math.max(0, ...siblings.map(d => (d as { order: number }).order)) + 10);
  const base = { id, path: target, title: options.title.trim(), description: options.description.trim(), body: skeleton[kind](), draft: true as const };
  const feature = target.split('/')[2]!;
  const doc: Doc = kind === 'feature' ? { kind, feature, ...base } : kind === 'wiki' ? { kind, ...base }
    : kind === 'instruction' ? { kind, name: path, ...base }
    : kind === 'requirement' ? { kind, feature, order, ...base } : { kind, feature, order, requirements: [], sources: [], ...base };
  const rendered = renderDocumentFile(doc);
  // The same parser as every later read decides whether the title and description are acceptable.
  parseDocumentFile(target, rendered);
  try { await createDocumentFile(project.root, target, rendered); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw new CommandError('DOCUMENT_EXISTS', t('docs.exists', { path: target }));
    if (code === 'ENOTDIR') throw new CommandError('INVALID_PATH', t('docs.notFolder', { path: target }));
    throw error;
  }
  const hasOrder = kind === 'requirement' || kind === 'design';
  return { json: { id, kind, path: target, ...(hasOrder ? { order } : {}) },
    text: text([t('docs.created', { id, path: target }), t('docs.createdNext')]) };
});

/**
 * `docs check`: every problem in the whole set of documents and reasons; exit code 1 when there is any. Link and asset
 * warnings are listed after them and never change the exit code.
 */
export const runDocsCheck = (options: Options) => runCommand('docs', options.format, async (): Promise<CommandResult> => {
  const project = await openProject(process.cwd());
  const { files, problems: unreadable } = await project.cache.documents.files();
  const result = checkDocuments(files);
  const problems = [...unreadable, ...result.problems];
  const warnings = await readDocumentWarnings(project.root, result.documents);
  return { json: { documents: result.documents.length, problems, warnings }, failed: problems.length > 0,
    text: text([...(problems.length ? [t('docs.problems', { count: problems.length }), ...problemLines(problems).map(l => '  ' + l)]
      : [t('docs.clean', { count: result.documents.length })]),
      ...section(t('docs.warnings', { count: warnings.length }), problemLines(warnings))]) };
});

/** `docs history`: why and when one document changed, newest first, from the commits of HEAD. */
export const runDocsHistory = (id: string, options: Options) => runCommand('docs', options.format, async () => {
  const project = await openProject(process.cwd());
  const head = await project.head();
  const events = head ? await project.cache.history.ofDocument(head, id) : [];
  const { documents } = await project.cache.documents.list();
  const title = documents.find(d => d.id === id)?.title ?? events.map(e => (e.after ?? e.before)?.title).find(Boolean) ?? null;
  if (!title && !events.length) throw new CommandError('UNKNOWN_DOCUMENT', t('docs.unknownDocument', { ids: id }));
  const json = { id, title, events: events.map(e => ({ commit: e.commit, date: e.date, author: e.author, email: e.email, message: e.message, types: e.types,
    path: (e.after ?? e.before)?.path ?? null, reasons: e.reasons })) };
  const out = [`${id} ${title ?? ''}`.trimEnd()];
  for (const e of json.events) {
    out.push('', `${e.date.slice(0, 10)} ${e.commit.slice(0, 7)} ${e.types.join(',')} — ${e.author}`);
    out.push(...e.reasons.map(r => '  ' + t('docs.reason') + ': ' + r), '  ' + t('docs.commit') + ': ' + e.message);
  }
  if (!events.length) out.push(t('docs.noHistory'));
  return { json, text: text(out) };
});
