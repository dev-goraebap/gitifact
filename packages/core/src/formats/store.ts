import { t } from '../shared/i18n/index.js';
import { extractLinks, resolveLink, type DocumentLink } from './links.js';

// The record store's file formats: specs, designs, wiki pages and their reasons, read and compared as bundles.
export class StoreError extends Error {
  readonly code = 'INVALID_STORE';
}
export interface StoreRequirement { id: string; title: string; body: string }
export interface StoreReason { id: string; requirements: string[]; designs?: string[]; documents?: string[]; reason: string }
/** A document the design drew on: one wiki page (repo-relative link) or one external URL, with an optional note. */
export interface DesignSource { title: string; path?: string; url?: string; note?: string }
export interface StoreDesign { title: string; body: string; requirements: string[]; sources: DesignSource[] }
export interface StoreSpec {
  id: string; path: string; title: string; description: string;
  requirements: StoreRequirement[]; history: StoreReason[]; design?: StoreDesign;
}
/** Wiki pages: a free folder tree under `.gitifact/wiki`, each page identified by the `id` in its frontmatter. */
export interface StoreDocument { id: string; path: string; title: string; body: string }
export interface StoreWiki { documents: StoreDocument[]; history: StoreReason[] }
export interface StoreBundle { specs: StoreSpec[]; wiki: StoreWiki }
export type StoreChangeKind = 'requirement' | 'design' | 'wiki';
export interface StoreSnapshotEntry { id: string; title: string; body: string; specId: string; path: string; sources?: DesignSource[] }
export interface StoreChange { id: string; types: ('created' | 'deleted' | 'moved' | 'modified')[]; before: StoreSnapshotEntry | null; after: StoreSnapshotEntry | null; kind: StoreChangeKind; reasons: StoreReason[] }
export const WIKI_DIR = '.gitifact/wiki';
export const WIKI_HISTORY_PATH = WIKI_DIR + '/history.jsonl';
/** The wiki entry page: the browser opens it first and GitHub shows it when the folder is browsed. */
export const WIKI_ENTRY = 'README.md';
export const WIKI_ENTRY_PATH = WIKI_DIR + '/' + WIKI_ENTRY;
const token = '[a-z2-7]{10}';
export const STORE_DIR = '.gitifact';
const marker = 'gitifact';
/** Path of a spec record or wiki page inside the store directory. */
export const recordPathPattern = /^(?:\.gitifact\/spec\/[^/]+\/(?:requirements\.md|design\.md|history\.jsonl)|\.gitifact\/wiki\/(?:(?:[^/]+\/)*[^/]+\.md|history\.jsonl))$/;
export const documentPathPattern = /^\.gitifact\/wiki\/((?:[^/]+\/)*[^/]+\.md)$/;
export const documentHistoryPattern = /^\.gitifact\/wiki\/history\.jsonl$/;
const nameToken = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Root pages may carry the conventional upper-case names (README.md, ARCHITECTURE.md, ...); everything else is lower-case. */
const rootUpperName = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\.md$/;
/** Relative page path inside the wiki: lower-case segments, `.md` file, at most 8 levels; `README.md` at the root is the entry page. */
export function validateDocumentRelativePath(relative: string): void {
  const parts = relative.split('/');
  if (relative.length > 200 || parts.length > 8) fail(t('document.pathTooLong', { path: relative }));
  const file = parts.pop()!;
  if (!(parts.length === 0 && rootUpperName.test(file)) && (!file.endsWith('.md') || !nameToken.test(file.slice(0, -3)))) fail(t('document.fileName', { path: relative }));
  for (const part of parts) if (!nameToken.test(part) || part.length > 80) fail(t('document.folderName', { path: relative }));
}
const reqId = new RegExp(`^R-${token}$`);
const fail = (message: string): never => { throw new StoreError(message); };
const normalized = (value: string) => value.replace(/\r\n/g, '\n').trim();

// ---- Frontmatter -------------------------------------------------------------------------------------------
// Records open with a YAML frontmatter block. Only the subset written here is read: `key: value` scalars and the
// `sources` list of flat maps. Anything else fails, so a hand edit cannot be misread as something it is not.
// Files written before frontmatter existed open with `<!-- gitifact-<kind>: ID -->`; they stay readable in history.
export interface Frontmatter { id: string; sources?: DesignSource[] }
const scalar = (value: string): string => {
  const quoted = /^"((?:[^"\\]|\\["\\])*)"$/.exec(value);
  if (quoted) return quoted[1]!.replace(/\\(["\\])/g, '$1');
  if (!value || /^["'#&*!|>%@`[{-]/.test(value) || /:\s|\s#/.test(value) || value !== value.trim()) fail(t('frontmatter.scalar', { value }));
  return value;
};
// Plain when `scalar` reads it back as the same string; otherwise double-quoted. Those are the only two forms accepted.
const quote = (value: string) => /^[A-Za-z0-9가-힣./_][^"#:\\]*$/.test(value) && value === value.trim() && !/\s#|:\s/.test(value) && !/^(true|false|null|yes|no|~)$/i.test(value) && !/^\d/.test(value) ? value : '"' + value.replace(/[\\"]/g, '\\$&') + '"';
function parseFrontmatter(lines: string[], kind: 'spec' | 'design' | 'wiki', legacyIds: string): Frontmatter {
  const legacy = new RegExp(`^<!-- ${marker}-(?:${kind === 'wiki' ? 'product|guide' : kind}): (${legacyIds}-${token}) -->$`).exec(lines[0] ?? '');
  if (legacy) { lines.shift(); return { id: legacy[1]! }; }
  if (lines[0] !== '---') fail(t('frontmatter.required'));
  lines.shift();
  const end = lines.indexOf('---');
  if (end === -1) fail(t('frontmatter.unclosed'));
  const block = lines.splice(0, end); lines.shift();
  const fields = new Map<string, string | DesignSource[]>();
  for (let i = 0; i < block.length; i++) {
    const line = block[i]!;
    if (!line.trim()) continue;
    const entry = /^([a-z]+):(?: (.*))?$/.exec(line);
    if (!entry || fields.has(entry[1]!)) fail(t('frontmatter.line', { line }));
    const [, key, value] = entry!;
    if (key !== 'sources') { if (value === undefined) fail(t('frontmatter.line', { line })); fields.set(key!, scalar(value!)); continue; }
    if (value !== undefined) fail(t('frontmatter.line', { line }));
    const sources: DesignSource[] = [];
    while (i + 1 < block.length && /^  /.test(block[i + 1]!)) {
      const item = block[++i]!;
      const head = /^  - ([a-z]+): (.*)$/.exec(item);
      if (!head) fail(t('frontmatter.line', { line: item }));
      const map: Record<string, string> = { [head![1]!]: scalar(head![2]!) };
      while (i + 1 < block.length && /^    [a-z]+: /.test(block[i + 1]!)) {
        const more = /^    ([a-z]+): (.*)$/.exec(block[++i]!)!;
        if (more[1]! in map) fail(t('frontmatter.line', { line: block[i]! }));
        map[more[1]!] = scalar(more[2]!);
      }
      sources.push(validateSource(map));
    }
    fields.set('sources', sources);
  }
  const id = fields.get('id');
  if (typeof id !== 'string' || !new RegExp(`^(?:${legacyIds})-${token}$`).test(id)) fail(t('frontmatter.id', { kind }));
  for (const key of fields.keys()) if (key !== 'id' && !(key === 'sources' && kind === 'design')) fail(t('frontmatter.unknownKey', { key }));
  const sources = fields.get('sources');
  return { id: id as string, ...(Array.isArray(sources) ? { sources } : {}) };
}
export function validateSource(value: unknown): DesignSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(t('source.invalid'));
  const map = value as Record<string, unknown>;
  const keys = Object.keys(map).sort();
  if (keys.some(k => !['title', 'path', 'url', 'note'].includes(k)) || typeof map.title !== 'string' || !map.title.trim() || ('path' in map) === ('url' in map)) fail(t('source.invalid'));
  for (const key of keys) { const v = map[key]; if (typeof v !== 'string' || !v.trim() || /[\r\n\0]/.test(v) || v.length > 500) fail(t('source.invalid')); }
  if (typeof map.url === 'string' && !/^https?:\/\/\S+$/.test(map.url)) fail(t('source.url', { url: map.url }));
  if (typeof map.path === 'string' && (/^[a-z]+:/i.test(map.path) || map.path.startsWith('/') || !map.path.endsWith('.md'))) fail(t('source.path', { path: map.path }));
  return { title: (map.title as string).trim(), ...(map.path !== undefined ? { path: (map.path as string).trim() } : {}), ...(map.url !== undefined ? { url: (map.url as string).trim() } : {}), ...(map.note !== undefined ? { note: (map.note as string).trim() } : {}) };
}
export function renderFrontmatter(front: Frontmatter): string {
  const lines = ['---', 'id: ' + front.id];
  if (front.sources?.length) {
    lines.push('sources:');
    for (const s of front.sources) {
      const entries = (['title', 'path', 'url', 'note'] as const).filter(k => s[k] !== undefined).map(k => k + ': ' + quote(s[k]!));
      lines.push('  - ' + entries[0], ...entries.slice(1).map(e => '    ' + e));
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

// ---- Design --------------------------------------------------------------------------------------------------
export function renderDesign(id: string, design: {title: string; body: string; sources?: DesignSource[]}): string {
  return renderFrontmatter({ id, ...(design.sources?.length ? { sources: design.sources } : {}) }) + `\n# ${design.title}\n\n${design.body}\n`;
}

/** References are explicit annotations outside fenced code; prose and examples are not identifiers. */
export function parseDesign(source: string, specId: string): StoreDesign {
  if (source.includes('\0') || /\r(?!\n)/.test(source)) fail(t('design.invalidCharacters'));
  const lines = normalized(source).split('\n');
  const front = parseFrontmatter(lines, 'design', 'S');
  if (front.id !== specId) fail(t('design.idMismatch'));
  while (lines[0] === '') lines.shift();
  const heading = lines.shift();
  if (!heading?.startsWith('# ') || !heading.slice(2).trim()) fail(t('design.titleRequired'));
  const title = heading!.slice(2).trim(); const raw = normalized(lines.join('\n'));
  if (!raw) fail(t('design.bodyRequired'));
  const references = new Set<string>(); let fence: {char: string; size: number} | undefined;
  const body = raw.split('\n').map(line => {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; return line; }
    if (/^#\s/.test(line)) fail(t('design.singleTopHeading'));
    if (/<!-- gitifact-/.test(line)) {
      const ref = /^<!-- gitifact-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/.exec(line);
      if (!ref) fail(t('design.referenceFormat'));
      for (const id of ref![1]!.split(', ')) references.add(id);
    }
    return line;
  }).join('\n');
  if (fence) fail(t('design.unclosedFence'));
  return {title, body, requirements: [...references], sources: front.sources ?? []};
}

// ---- Wiki ----------------------------------------------------------------------------------------------------
export function renderDocument(doc: {id: string; title: string; body: string}): string {
  return renderFrontmatter({ id: doc.id }) + `\n# ${doc.title}\n\n${doc.body}\n`;
}

/** A wiki page is one Markdown file: frontmatter with its ID, title, body. Other gitifact annotations outside fenced code are rejected. */
export function parseDocument(path: string, source: string): StoreDocument {
  const match = documentPathPattern.exec(path);
  if (!match) fail(t('document.unsupportedPath', { path }));
  validateDocumentRelativePath(match![1]!);
  if (source.includes('\0') || /\r(?!\n)/.test(source)) fail(t('document.invalidCharacters', { path }));
  const lines = normalized(source).split('\n');
  const { id } = parseFrontmatter(lines, 'wiki', 'W');
  while (lines[0] === '') lines.shift();
  const heading = lines.shift();
  if (!heading?.startsWith('# ') || !heading.slice(2).trim()) fail(t('document.titleRequired', { path }));
  const title = heading!.slice(2).trim(); const body = normalized(lines.join('\n'));
  if (!body) fail(t('document.bodyRequired', { path }));
  let fence: {char: string; size: number} | undefined;
  for (const line of body.split('\n')) {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; continue; }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; continue; }
    if (/^#\s/.test(line)) fail(t('document.singleTopHeading', { path }));
    if (/<!-- gitifact-/.test(line)) fail(t('document.noMarkerInBody', { path }));
  }
  if (fence) fail(t('document.unclosedFence', { path }));
  return { id, path, title, body };
}

export function parseWikiFiles(files: ReadonlyMap<string, string>): StoreWiki {
  const wiki: StoreWiki = { documents: [], history: parseHistory(files.get(WIKI_HISTORY_PATH) ?? '', 'documents') };
  for (const [path, source] of files) if (documentPathPattern.test(path)) wiki.documents.push(parseDocument(path, source));
  wiki.documents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  validateWiki(wiki); return wiki;
}

export function validateWiki(wiki: StoreWiki): void {
  const ids = new Set<string>(); const paths = new Set<string>(); const historyIds = new Set<string>();
  for (const d of wiki.documents) {
    if (ids.has(d.id)) fail(t('document.duplicateId', { id: d.id })); ids.add(d.id);
    const lower = d.path.toLowerCase(); if (paths.has(lower)) fail(t('document.caseOnlyPath', { path: d.path })); paths.add(lower);
  }
  for (const h of wiki.history) { if (historyIds.has(h.id)) fail(t('history.duplicateId', { id: h.id })); historyIds.add(h.id); }
}

export const emptyWiki = (): StoreWiki => ({ documents: [], history: [] });
export const emptyBundle = (): StoreBundle => ({ specs: [], wiki: emptyWiki() });

export function parseStoreBundle(files: ReadonlyMap<string, string>): StoreBundle {
  const bundle = { specs: parseSpecFiles(files), wiki: parseWikiFiles(files) };
  validateBundle(bundle); return bundle;
}

export function validateBundle(bundle: StoreBundle): void {
  validateSpecs(bundle.specs); validateWiki(bundle.wiki);
  const ids = new Set<string>();
  for (const h of [...bundle.specs.flatMap(s => s.history), ...bundle.wiki.history]) { if (ids.has(h.id)) fail(t('history.duplicateId', { id: h.id })); ids.add(h.id); }
}

export type StoreWarning =
  | { code: 'MISSING_DESIGN_REFERENCE'; specId: string; requirement: string }
  | { code: 'MISSING_LINK_TARGET'; path: string; target: string; link: string }
  | { code: 'ASSET_SIZE' | 'ASSET_EXTENSION' | 'UNREFERENCED_ASSET'; path: string; bytes?: number }
  | { code: 'ASSETS_TOTAL_SIZE'; bytes: number };
export function designReferenceWarnings(specs: StoreSpec[]): StoreWarning[] {
  const known = new Set(specs.flatMap(s => s.requirements.map(r => r.id)));
  return specs.flatMap(s => (s.design?.requirements ?? []).filter(id => !known.has(id)).map(id => ({specId: s.id, requirement: id, code: 'MISSING_DESIGN_REFERENCE' as const})));
}

// ---- Links ---------------------------------------------------------------------------------------------------
/** Every relative link of every record, resolved to a repo-relative path; design sources by path are included. */
export function documentLinks(bundle: StoreBundle): DocumentLink[] {
  const out: DocumentLink[] = [];
  const collect = (from: string, links: string[]) => { for (const link of links) { const target = resolveLink(from, link); if (target !== null) out.push({ from, link, target }); } };
  for (const s of bundle.specs) {
    collect(s.path, extractLinks(s.description + '\n' + s.requirements.map(r => r.body).join('\n')));
    if (s.design) { const path = s.path.replace(/requirements\.md$/, 'design.md'); collect(path, [...extractLinks(s.design.body), ...s.design.sources.flatMap(x => x.path ? [x.path] : [])]); }
  }
  for (const d of bundle.wiki.documents) collect(d.path, extractLinks(d.body));
  return out;
}

// ---- Specs ---------------------------------------------------------------------------------------------------
export function parseSpecFiles(files: ReadonlyMap<string, string>): StoreSpec[] {
  const specs: StoreSpec[] = [];
  for (const [path, source] of files) {
    if (documentPathPattern.test(path) || documentHistoryPattern.test(path)) continue;
    if (path.endsWith('/requirements.md')) {
      specs.push(parseSpec(path, source, files.get(path.replace(/requirements\.md$/, 'history.jsonl')) ?? '', files.get(path.replace(/requirements\.md$/, 'design.md'))));
    } else if (!files.has(path.replace(/(?:history\.jsonl|design\.md)$/, 'requirements.md'))) fail(t('spec.orphanFile', { path }));
  }
  validateSpecs(specs); return specs;
}

export function parseSpec(path: string, source: string, history = '', designSource?: string): StoreSpec {
  if (!/^\.gitifact\/spec\/[^/]+\/requirements\.md$/.test(path)) fail(t('spec.unsupportedPath', { path }));
  if (source.includes('\0') || source.includes('\r') && /\r(?!\n)/.test(source)) fail(t('spec.invalidCharacters', { path }));
  const lines = normalized(source).split('\n');
  const specId = parseFrontmatter(lines, 'spec', 'S').id;
  let title = ''; let description = ''; let current: StoreRequirement | undefined;
  const requirements: StoreRequirement[] = [];
  let fence: { char: string; size: number } | undefined;
  let waitingId = false;
  const append = (line: string) => {
    if (current) current.body += line + '\n'; else description += line + '\n';
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (waitingId) {
      const match = new RegExp(`^<!-- ${marker}-req: (R-${token}) -->$`).exec(line);
      if (!match || !current) fail(t('spec.requirementIdRequired', { path }));
      current!.id = match![1]!; waitingId = false; continue;
    }
    if (fence) {
      append(line);
      if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening) {
      if (opening[1]![0] === '`' && opening[2]!.includes('`')) fail(t('spec.invalidFence'));
      fence = { char: opening[1]![0]!, size: opening[1]!.length }; append(line); continue;
    }
    if (/^# /.test(line)) {
      if (title || current || description.trim()) fail(t('spec.titleOnce', { path }));
      title = line.slice(2).trim(); if (!title) fail(t('spec.emptyTitle')); continue;
    }
    if (/^## /.test(line)) {
      if (!title) fail(t('spec.titleMissing', { path }));
      current = { id: '', title: line.slice(3).trim(), body: '' };
      if (!current.title) fail(t('spec.emptyRequirementTitle'));
      requirements.push(current); waitingId = true; continue;
    }
    // Fail closed on reserved annotations outside the supported position.
    if (line.includes('<!--') || line.includes('-->')) fail(t('spec.commentPosition', { path }));
    if (/^ {1,3}#{1,2}\s|^#{1,2}\t|^\s*(?:===+|---+)\s*$/.test(line)) fail(t('spec.atxOnly', { path }));
    append(line);
  }
  if (!title || waitingId || fence) fail(t('spec.incomplete', { path }));
  const ids = new Set<string>();
  for (const r of requirements) {
    r.body = normalized(r.body);
    if (!r.body || ids.has(r.id)) fail(t('spec.emptyOrDuplicateRequirement', { id: r.id }));
    ids.add(r.id);
  }
  return { id: specId, path, title, description: normalized(description), requirements, history: parseHistory(history), ...(designSource === undefined ? {} : { design: parseDesign(designSource, specId) }) };
}

export function parseHistory(source: string, scope: 'spec' | 'documents' = 'spec'): StoreReason[] {
  const records: StoreReason[] = []; const ids = new Set<string>();
  const shapes = scope === 'spec' ? ['id,reason,requirements', 'designs,id,reason,requirements'] : ['documents,id,reason,requirements'];
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { fail(t('history.invalidJsonl')); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(t('history.invalidRecord'));
    const r = value as Record<string, unknown>;
    if (!shapes.includes(Object.keys(r).sort().join(','))
      || typeof r.id !== 'string' || !new RegExp(`^H-${token}$`).test(r.id)
      || ids.has(r.id) || typeof r.reason !== 'string' || !r.reason.trim()
      || !Array.isArray(r.requirements) || (!r.requirements.length && !Array.isArray(r.designs) && !Array.isArray(r.documents))
      || (r.documents !== undefined && (r.requirements.length || !Array.isArray(r.documents) || !r.documents.length || r.documents.some(id => typeof id !== 'string' || !/^W-[a-z2-7]{10}$/.test(id)) || new Set(r.documents).size !== r.documents.length))
      || (r.designs !== undefined && (!Array.isArray(r.designs) || !r.designs.length || r.designs.some(id => typeof id !== 'string' || !/^S-[a-z2-7]{10}$/.test(id)) || new Set(r.designs).size !== r.designs.length))
      || r.requirements.some(id => typeof id !== 'string' || !reqId.test(id))
      || new Set(r.requirements).size !== r.requirements.length) fail(t('history.invalidFields'));
    ids.add(r.id as string); records.push({ id: r.id as string, requirements: r.requirements as string[], ...(r.designs === undefined ? {} : { designs: r.designs as string[] }), ...(r.documents === undefined ? {} : { documents: r.documents as string[] }), reason: r.reason as string });
  }
  return records;
}

export function validateSpecs(specs: StoreSpec[]): void {
  const specIds = new Set<string>(); const reqIds = new Set<string>(); const historyIds = new Set<string>();
  for (const s of specs) {
    if (specIds.has(s.id)) fail(t('spec.duplicateId', { id: s.id })); specIds.add(s.id);
    for (const r of s.requirements) {
      if (reqIds.has(r.id)) fail(t('spec.duplicateRequirementId', { id: r.id })); reqIds.add(r.id);
    }
    for (const h of s.history) {
      if (historyIds.has(h.id)) fail(t('history.duplicateId', { id: h.id })); historyIds.add(h.id);
    }
  }
  // Old reasons may refer to requirements since deleted or moved; validate new links when comparing.
}

const sameEntry = (a: StoreSnapshotEntry, b: StoreSnapshotEntry) => a.title === b.title && a.body === b.body && JSON.stringify(a.sources ?? []) === JSON.stringify(b.sources ?? []);
export function compareSpecs(before: StoreSpec[], after: StoreSpec[]) {
  validateSpecs(before); validateSpecs(after);
  const index = (specs: StoreSpec[]) => new Map<string, StoreSnapshotEntry>(specs.flatMap(s => s.requirements.map(r => [r.id, { ...r, specId: s.id, path: s.path }] as const)));
  const prev = index(before); const next = index(after);
  for (const [specs, map] of [[before, prev], [after, next]] as const) for (const s of specs) if (s.design) map.set(s.id, { id: s.id, title: s.design.title, body: s.design.body, specId: s.id, path: s.path.replace(/requirements\.md$/, 'design.md'), sources: s.design.sources });
  const previousHistory = new Map(before.flatMap(s => s.history.map(h => [h.id, h] as const)));
  const reasons = after.flatMap(s => s.history).filter(h => {
    const old = previousHistory.get(h.id);
    if (old && JSON.stringify(old) !== JSON.stringify(h)) fail(t('history.changed', { id: h.id }));
    return !old;
  });
  const changes = [...new Set([...prev.keys(), ...next.keys()])].sort().flatMap(id => {
    const from = prev.get(id) ?? null; const to = next.get(id) ?? null;
    const types: ('created' | 'deleted' | 'moved' | 'modified')[] = [];
    if (!from) types.push('created'); else if (!to) types.push('deleted');
    else {
      if (from.specId !== to.specId || (id.startsWith('S-') && from.path !== to.path)) types.push('moved');
      if (!sameEntry(from, to)) types.push('modified');
    }
    return types.length ? [{ id, types, before: from, after: to, kind: id.startsWith('S-') ? 'design' as const : 'requirement' as const, reasons: reasons.filter(h => [...h.requirements, ...(h.designs ?? [])].includes(id)) } satisfies StoreChange] : [];
  });
  const changed = new Set(changes.map(c => c.id));
  for (const h of reasons) if ([...h.requirements, ...(h.designs ?? [])].some(id => !changed.has(id))) fail(t('history.unlinkedRequirement', { id: h.id }));
  const prevSpecs = new Map(before.map(s => [s.id, s])); const nextSpecs = new Map(after.map(s => [s.id, s]));
  const specChanges = [...new Set([...prevSpecs.keys(), ...nextSpecs.keys()])].sort().flatMap(id => {
    const from = prevSpecs.get(id); const to = nextSpecs.get(id);
    const summary = (s: StoreSpec | undefined) => s ? { path: s.path, title: s.title, description: s.description } : null;
    const a = summary(from); const b = summary(to);
    return JSON.stringify(a) !== JSON.stringify(b) ? [{ id, before: a, after: b }] : [];
  });
  return { specChanges, changes };
}

/** Wiki pages compare by ID: a new path is a move, a new title or body a modification. New reasons must name changed pages. */
export function compareWikis(before: StoreWiki, after: StoreWiki): StoreChange[] {
  validateWiki(before); validateWiki(after);
  const index = (wiki: StoreWiki) => new Map(wiki.documents.map(d => [d.id, { id: d.id, title: d.title, body: d.body, specId: 'wiki', path: d.path }] as const));
  const prev = index(before); const next = index(after);
  const previousHistory = new Map(before.history.map(h => [h.id, h] as const));
  const reasons = after.history.filter(h => {
    const old = previousHistory.get(h.id);
    if (old && JSON.stringify(old) !== JSON.stringify(h)) fail(t('history.changed', { id: h.id }));
    return !old;
  });
  const changes = [...new Set([...prev.keys(), ...next.keys()])].sort().flatMap(id => {
    const from = prev.get(id) ?? null; const to = next.get(id) ?? null;
    const types: StoreChange['types'] = [];
    if (!from) types.push('created'); else if (!to) types.push('deleted');
    else { if (from.path !== to.path) types.push('moved'); if (from.title !== to.title || from.body !== to.body) types.push('modified'); }
    return types.length ? [{ id, types, before: from, after: to, kind: 'wiki' as const, reasons: reasons.filter(h => (h.documents ?? []).includes(id)) }] : [];
  });
  const changed = new Set(changes.map(c => c.id));
  for (const h of reasons) if ((h.documents ?? []).some(id => !changed.has(id))) fail(t('history.unlinkedDocument', { id: h.id }));
  return changes;
}

export function compareStoreBundles(a: StoreBundle, b: StoreBundle) {
  validateBundle(a); validateBundle(b);
  const specs = compareSpecs(a.specs, b.specs);
  return { specChanges: specs.specChanges, changes: [...specs.changes, ...compareWikis(a.wiki, b.wiki)] as StoreChange[] };
}
