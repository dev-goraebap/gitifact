import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyDocPath, parseDocumentFile, renderDocumentFile, INSTRUCTION_FILE, INSTRUCTIONS_ROOT, SPEC_ROOT, type DesignDoc, type Doc, type DocKind } from '@gitifact/core';
import { createDocumentFile, generateId } from '../adapters/filesystem/document-file.js';
import { listInstructionFiles } from '../adapters/filesystem/instruction-folder.js';
import { CommandError, section, text, type CommandResult } from './output.js';
import { documentsOf, type Project } from './project.js';
import { t } from '../shared/i18n/index.js';

// What `specs` and `instructions` share: reading documents as written with the documents on either side, and
// creating one with an issued ID. Each resource decides which kinds it takes.

export type NewKind = 'feature' | 'requirement' | 'design' | 'instruction';

export const draftMark = (doc: { draft?: true }) => doc.draft ? ' (' + t('docs.draft') + ')' : '';
/** The path people type and the viewer shows: inside `.gitifact`, without that prefix. */
export const place = (path: string) => path.replace(/^\.gitifact\//, '');
export const line = (doc: Doc) => `${doc.id} ${doc.title}${draftMark(doc)} — ${doc.description}`;
/** A design's sources with the titles of the documents they name. */
export const titledSources = (d: DesignDoc, byId: ReadonlyMap<string, Doc>) =>
  d.sources.map(s => 'id' in s ? { id: s.id, title: byId.get(s.id)?.title ?? null, ...(s.note ? { note: s.note } : {}) } : s);

export interface DocumentView {
  byId: Map<string, Doc>;
  read(path: string): Promise<string>;
  referencing(id: string): Promise<string[]>;
}
/** The working tree, read through the cache. */
export async function working(project: Project): Promise<DocumentView> {
  const { documents } = await project.cache.documents.list();
  return {
    byId: new Map(documents.map(d => [d.id, d])),
    read: (path: string) => readFile(join(project.root, ...path.split('/')), 'utf8'),
    referencing: async (id: string) => [...new Set((await project.cache.documents.referencing(id)).map(r => r.from))],
  };
}
/** One commit, read from Git and not kept. */
export async function committed(project: Project, commit: string): Promise<DocumentView> {
  const files = await project.cache.history.filesAt(commit);
  const documents = documentsOf(files);
  return {
    byId: new Map(documents.map(d => [d.id, d])),
    read: async (path: string) => files.get(path)!,
    referencing: async (id: string) => documents.filter(d => d.kind === 'design' && (d.requirements.includes(id) || d.sources.some(s => 'id' in s && s.id === id))).map(d => d.id),
  };
}

/**
 * `specs show` and `instructions show`: each file exactly as it is, so an agent quotes and edits the same bytes,
 * followed by the documents it points at and the documents that point at it. With a commit, everything is read from
 * that commit. An ID of the other resource is refused with the command that reads it.
 */
export async function showDocuments(project: Project, ids: string[], at: string | undefined, kinds: readonly DocKind[], otherResource: string): Promise<CommandResult> {
  const view = at === undefined ? await working(project) : await committed(project, at);
  const unknown = ids.filter(id => !view.byId.has(id));
  if (unknown.length) throw new CommandError('UNKNOWN_DOCUMENT', t('docs.unknownDocument', { ids: unknown.join(', ') }));
  const other = ids.filter(id => !kinds.includes(view.byId.get(id)!.kind));
  if (other.length) throw new CommandError('UNKNOWN_DOCUMENT', t('docs.otherResource', { ids: other.join(', '), command: otherResource }));
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
}

// Per kind: how its path is written, and the body `new` starts it with.
const pathExample: Record<NewKind, () => string> = {
  feature: () => t('docs.pathExample.feature'), requirement: () => t('docs.pathExample.requirement'),
  design: () => t('docs.pathExample.design'), instruction: () => t('docs.pathExample.instruction'),
};
const skeleton: Record<NewKind, () => string> = {
  feature: () => t('docs.skeleton.feature'), requirement: () => t('docs.skeleton.requirement'),
  design: () => t('docs.skeleton.design'), instruction: () => t('docs.skeleton.instruction'),
};

/** Where a new document goes: a feature folder, a requirement or design slug in one, or an instruction folder. */
function newPath(kind: NewKind, path: string): string {
  const target = kind === 'feature' ? `${SPEC_ROOT}/${path}/index.md`
    : kind === 'instruction' ? `${INSTRUCTIONS_ROOT}/${path}/${INSTRUCTION_FILE}`
    : `${SPEC_ROOT}/${path.split('/')[0]}/${kind === 'requirement' ? 'requirements' : 'design'}/${path.split('/').slice(1).join('/')}.md`;
  const shape = kind === 'feature' || kind === 'instruction' ? /^[^/]+$/ : /^[^/]+\/[^/]+$/;
  let where; try { where = shape.test(path) ? classifyDocPath(target) : undefined; } catch { where = undefined; }
  if (where?.type !== 'doc' || where.kind !== kind) throw new CommandError('INVALID_PATH', t('docs.invalidPath', { kind, path, example: pathExample[kind]() }));
  return target;
}

/**
 * `specs new` and `instructions new`: issues the ID, fills the frontmatter and writes a skeleton body with
 * `draft: true`, which the check refuses until the author has written the document and removed the line.
 */
export async function createDocument(project: Project, kind: NewKind, path: string, options: { title: string; description: string }): Promise<CommandResult> {
  for (const [field, value] of [['title', options.title], ['description', options.description]] as const) {
    if (/[\r\n]/.test(value)) throw new CommandError('INVALID_VALUE', t('docs.singleLine', { field }));
  }
  const target = newPath(kind, path);
  const { documents } = await project.cache.documents.list();
  const taken = new Set(documents.map(d => d.id));
  let id: string; do id = generateId(({ feature: 'S', requirement: 'R', design: 'D', instruction: 'I' } as const)[kind]); while (taken.has(id));
  const folder = target.slice(0, target.lastIndexOf('/') + 1);
  const siblings = documents.filter(d => (d.kind === 'requirement' || d.kind === 'design') && d.path.startsWith(folder) && !d.path.slice(folder.length).includes('/'));
  const order = Math.min(999999, Math.max(0, ...siblings.map(d => (d as { order: number }).order)) + 10);
  const base = { id, path: target, title: options.title.trim(), description: options.description.trim(), body: skeleton[kind](), draft: true as const };
  const feature = target.split('/')[2]!;
  const doc: Doc = kind === 'feature' ? { kind, feature, ...base }
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
}
