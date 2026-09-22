import { DocumentError, docIdPattern, idPatternOf, reasonIdPattern, type Doc, type DocKind, type DocReason, type DocSource } from '../domain/document.js';
import { parseFrontmatterBlock, renderFrontmatterBlock, type FrontFields } from './frontmatter.js';
import { t } from '../shared/i18n/index.js';

// Where each kind of 0.8.0 document lives, and how one file reads and renders.
//   .gitifact/spec/<feature>/index.md                 feature overview (S-)
//   .gitifact/spec/<feature>/requirements/<slug>.md   one requirement (R-)
//   .gitifact/spec/<feature>/design/<slug>.md         one design axis (D-); design/overview.md is required once a design exists
//   .gitifact/spec/<feature>/history.jsonl            reasons for the feature's documents
//   .gitifact/wiki/**/*.md, .gitifact/wiki/history.jsonl

export const SPEC_ROOT = '.gitifact/spec';
export const WIKI_ROOT = '.gitifact/wiki';
const name = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Root wiki pages may carry the conventional upper-case names (README.md, ARCHITECTURE.md, ...). */
const rootUpperName = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\.md$/;

export type DocPath =
  | { type: 'doc'; kind: 'feature'; feature: string }
  | { type: 'doc'; kind: 'requirement' | 'design'; feature: string; slug: string }
  | { type: 'doc'; kind: 'wiki' }
  | { type: 'reasons'; feature: string | null }
  | { type: 'ignored' };

/** What a repository path under `.gitifact/spec` or `.gitifact/wiki` is. Files elsewhere are ignored; unknown files in spec folders are refused. */
export function classifyDocPath(path: string): DocPath {
  const unsupported = () => new DocumentError('PATH_UNSUPPORTED', path, t('doc.PATH_UNSUPPORTED', { path }));
  if (path.startsWith(SPEC_ROOT + '/')) {
    const parts = path.slice(SPEC_ROOT.length + 1).split('/');
    const feature = parts[0]!;
    if (!name.test(feature) || feature.length > 80) throw unsupported();
    if (parts.length === 2 && parts[1] === 'index.md') return { type: 'doc', kind: 'feature', feature };
    if (parts.length === 2 && parts[1] === 'history.jsonl') return { type: 'reasons', feature };
    if (parts.length === 3 && (parts[1] === 'requirements' || parts[1] === 'design') && parts[2]!.endsWith('.md')) {
      const slug = parts[2]!.slice(0, -3);
      if (!name.test(slug) || slug.length > 80) throw unsupported();
      return { type: 'doc', kind: parts[1] === 'requirements' ? 'requirement' : 'design', feature, slug };
    }
    throw unsupported();
  }
  if (path.startsWith(WIKI_ROOT + '/')) {
    const relative = path.slice(WIKI_ROOT.length + 1);
    if (relative === 'history.jsonl') return { type: 'reasons', feature: null };
    // Images and other files beside the pages are not documents.
    if (!relative.endsWith('.md')) return { type: 'ignored' };
    const parts = relative.split('/'); const file = parts.pop()!;
    if (relative.length > 200 || parts.length > 7) throw unsupported();
    if (!(parts.length === 0 && rootUpperName.test(file)) && !name.test(file.slice(0, -3))) throw unsupported();
    if (parts.some(part => !name.test(part) || part.length > 80)) throw unsupported();
    return { type: 'doc', kind: 'wiki' };
  }
  return { type: 'ignored' };
}

const KEYS: Record<DocKind, string[]> = {
  feature: ['id', 'title', 'description'],
  requirement: ['id', 'title', 'description', 'order'],
  design: ['id', 'title', 'description', 'order', 'requirements', 'sources'],
  wiki: ['id', 'title', 'description'],
};
const REQUIRED: Record<DocKind, string[]> = {
  feature: ['id', 'title', 'description'], requirement: ['id', 'title', 'description', 'order'],
  design: ['id', 'title', 'description', 'order'], wiki: ['id', 'title', 'description'],
};

function text(fields: FrontFields, key: string, path: string, limit: number): string {
  const field = fields.get(key);
  if (field?.type !== 'scalar' || !field.value.trim() || field.value.length > limit || /[\r\n\0]/.test(field.value)) {
    throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: key }));
  }
  return field.value.trim();
}
function sources(fields: FrontFields, path: string): DocSource[] {
  const field = fields.get('sources');
  if (!field) return [];
  const invalid = () => new DocumentError('SOURCE_INVALID', path, t('doc.SOURCE_INVALID', { path }));
  if (field.type !== 'maps') throw invalid();
  return field.items.map(item => {
    const keys = Object.keys(item);
    if (Object.values(item).some(v => !v.trim() || v.length > 500)) throw invalid();
    const note = item.note !== undefined ? { note: item.note.trim() } : {};
    if ('id' in item) {
      if (keys.some(k => k !== 'id' && k !== 'note') || !docIdPattern.test(item.id!)) throw invalid();
      return { id: item.id!, ...note };
    }
    if (keys.some(k => !['title', 'url', 'note'].includes(k)) || !item.title || !item.url || !/^https?:\/\/\S+$/.test(item.url)) throw invalid();
    return { title: item.title.trim(), url: item.url, ...note };
  });
}

/** The body is prose: required, no `#` title (the title is in frontmatter), no gitifact comments outside fenced code. */
function body(raw: string, path: string): string {
  const value = raw.trim();
  if (!value) throw new DocumentError('BODY_REQUIRED', path, t('doc.BODY_REQUIRED', { path }));
  let fence: { char: string; size: number } | undefined;
  for (const line of value.split('\n')) {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; continue; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = { char: open[1]![0]!, size: open[1]!.length }; continue; }
    if (/^#\s/.test(line)) throw new DocumentError('BODY_HEADING', path, t('doc.BODY_HEADING', { path }));
    if (/<!-- gitifact-/.test(line)) throw new DocumentError('BODY_MARKER', path, t('doc.BODY_MARKER', { path }));
  }
  if (fence) throw new DocumentError('BODY_UNCLOSED_FENCE', path, t('doc.BODY_UNCLOSED_FENCE', { path }));
  return value;
}

/** Reads one document file. Throws DocumentError for the first problem in it; `checkDocuments` collects them per file. */
export function parseDocumentFile(path: string, source: string): Doc {
  const where = classifyDocPath(path);
  if (where.type !== 'doc') throw new DocumentError('PATH_UNSUPPORTED', path, t('doc.PATH_UNSUPPORTED', { path }));
  if (source.includes('\0') || /\r(?!\n)/.test(source) || source.charCodeAt(0) === 0xfeff) throw new DocumentError('INVALID_CHARACTERS', path, t('doc.INVALID_CHARACTERS', { path }));
  const { fields, body: rawBody } = parseFrontmatterBlock(source.replace(/\r\n/g, '\n'), path);
  const kind = where.kind;
  for (const key of fields.keys()) if (!KEYS[kind].includes(key)) throw new DocumentError('FRONTMATTER_UNKNOWN_KEY', path, t('doc.FRONTMATTER_UNKNOWN_KEY', { path, key }));
  for (const key of REQUIRED[kind]) if (!fields.has(key)) throw new DocumentError('FRONTMATTER_MISSING_KEY', path, t('doc.FRONTMATTER_MISSING_KEY', { path, key }));
  const id = fields.get('id');
  if (id?.type !== 'scalar' || !idPatternOf(kind).test(id.value)) throw new DocumentError('ID_FORMAT', path, t('doc.ID_FORMAT', { path, kind }));
  const common = { id: id.value, path, title: text(fields, 'title', path, 200), description: text(fields, 'description', path, 300), body: body(rawBody, path) };
  const order = () => {
    const field = fields.get('order');
    if (field?.type !== 'scalar' || !/^(0|[1-9]\d{0,5})$/.test(field.value)) throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: 'order' }));
    return Number(field.value);
  };
  if (where.kind === 'feature') return { kind: 'feature', feature: where.feature, ...common };
  if (where.kind === 'wiki') return { kind: 'wiki', ...common };
  if (where.kind === 'requirement') return { kind: 'requirement', feature: where.feature, order: order(), ...common };
  const refs = fields.get('requirements');
  if (refs && (refs.type !== 'list' || refs.items.some(r => !idPatternOf('requirement').test(r)) || new Set(refs.items).size !== refs.items.length)) {
    throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value: 'requirements' }));
  }
  return { kind: 'design', feature: where.feature, order: order(), requirements: refs?.type === 'list' ? refs.items : [], sources: sources(fields, path), ...common };
}

/** Canonical text of a document: frontmatter in a fixed key order, a blank line, the body and a final newline. */
export function renderDocumentFile(doc: Doc): string {
  const front = renderFrontmatterBlock([
    ['id', doc.id], ['title', doc.title], ['description', doc.description],
    ['order', doc.kind === 'requirement' || doc.kind === 'design' ? doc.order : undefined],
    ['requirements', doc.kind === 'design' ? doc.requirements : undefined],
    ['sources', doc.kind === 'design' ? doc.sources.map(s => ({ ...s })) as Record<string, string>[] : undefined],
  ]);
  return `${front}\n\n${doc.body}\n`;
}

/** Reads history.jsonl: one `{id, docs, reason}` object per line. Blank lines are skipped. */
export function parseReasonLines(path: string, source: string): DocReason[] {
  const invalid = (line: number) => new DocumentError('REASON_INVALID', path, t('doc.REASON_INVALID', { path, line }));
  const reasons: DocReason[] = [];
  source.replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw invalid(index + 1); }
    const r = value as Record<string, unknown>;
    if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).sort().join(',') !== 'docs,id,reason'
      || typeof r.id !== 'string' || !reasonIdPattern.test(r.id)
      || !Array.isArray(r.docs) || !r.docs.length || r.docs.some(d => typeof d !== 'string' || !docIdPattern.test(d)) || new Set(r.docs).size !== r.docs.length
      || typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 4000 || r.reason.includes('\0')) throw invalid(index + 1);
    reasons.push({ id: r.id, docs: r.docs as string[], reason: r.reason });
  });
  return reasons;
}
export const renderReasonLine = (reason: DocReason) => JSON.stringify({ id: reason.id, docs: reason.docs, reason: reason.reason });
