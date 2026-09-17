import { parseSpecPreview, renderDesignPreview, parseDesignPreview, SpecPreviewError, validatePreviewSnapshot, asBundle, validateBundle, parseDocument, renderDocument, validateDocumentRelativePath, DOCUMENT_DIRS, PRODUCT_PATH, type PreviewSpec, type PreviewBundle, type DocumentKind, type PreviewDocument } from '../formats/spec-preview.js';
import { t } from '../shared/i18n/index.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const featurePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
export function previewPath(feature: string): string {
  if (!featurePattern.test(feature) || feature.length > 80 || reserved.test(feature)) fail(t('edit.invalidFeatureName'));
  return `.gitifact/spec/${feature}/requirements.md`;
}
export function renderSpecPreview(spec: PreviewSpec): string {
  return `<!-- gitifact-spec: ${spec.id} -->\n\n# ${spec.title}\n\n`
    + (spec.description ? spec.description + '\n\n' : '')
    + spec.requirements.map(r => `## ${r.title}\n<!-- gitifact-req: ${r.id} -->\n\n${r.body}\n`).join('\n');
}

export type IdPrefix = 'S' | 'R' | 'P' | 'G';
/** Draft edits only. History and Git state are not part of this operation. */
export function editSpecPreview(original: PreviewSpec[] | PreviewBundle, input: unknown, generate: (prefix: IdPrefix) => string) {
  if (!Array.isArray(input) || !input.length || input.length > 100) fail(t('edit.operationCount'));
  const source = asBundle(original);
  const specs: PreviewSpec[] = source.specs.map(s => ({ ...s, requirements: s.requirements.map(r => ({ ...r })), history: s.history.map(h => ({ ...h, requirements: [...h.requirements] })) }));
  const documents = source.documents.map(set => ({ ...set, documents: set.documents.map(d => ({ ...d })), history: set.history.map(h => ({ ...h })) }));
  validateBundle({ specs, documents });
  const used = new Set([...specs.flatMap(s => [s.id, ...s.requirements.map(r => r.id)]), ...documents.flatMap(d => d.documents.map(x => x.id))]);
  const allocate = (prefix: IdPrefix) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = generate(prefix);
      if (!new RegExp(`^${prefix}-[a-z2-7]{10}$`).test(id)) fail(t('edit.idGenerated'));
      if (!used.has(id)) { used.add(id); return id; }
    }
    return fail(t('edit.idUnavailable'));
  };
  const results: { type: string; id: string }[] = [];
  for (const raw of input as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(t('edit.invalidOperation'));
    const op = raw as Record<string, unknown>;
    const schemas: Record<string, string[]> = {
      create: ['type', 'feature', 'title', 'description'], add: ['type', 'feature', 'title', 'body'],
      update: ['type', 'id', 'title', 'body'], move: ['type', 'id', 'feature'],
      'rename-spec': ['type', 'id', 'title'],
      'set-design': ['type', 'feature', 'title', 'body'], 'delete-design': ['type', 'feature'],
      'create-doc': ['type', 'path', 'title', 'body'], 'update-doc': ['type', 'id', 'title', 'body'],
      'move-doc': ['type', 'id', 'path'], 'delete-doc': ['type', 'id'],
      'set-product': ['type', 'title', 'body'], 'delete-product': ['type'],
    };
    const type = String(op.type); const fields = schemas[type];
    if (!fields || Object.keys(op).some(k => !fields.includes(k))) fail(t('edit.unsupportedField'));
    const str = (key: string, optional = false) => {
      if (optional && op[key] === undefined) return '';
      if (typeof op[key] !== 'string' || !(op[key] as string).trim()) return fail(t('edit.emptyField', { field: key }));
      const value = (op[key] as string).replace(/\r\n/g, '\n').trim();
      if (value.includes('\0') || value.includes('\r') || (key !== 'body' && key !== 'description' && /[\n]/.test(value))) fail(t('edit.invalidCharacters', { field: key }));
      return value;
    };
    const target = () => {
      const path = previewPath(str('feature'));
      return specs.find(s => s.path === path) ?? fail(t('edit.specNotFound', { path }));
    };
    if (type === 'set-product' || type === 'delete-product') {
      const set = documents.find(s => s.kind === 'product')!; const existing = set.documents[0];
      if (type === 'delete-product') { if (!existing) fail(t('edit.noProductToDelete')); set.documents = []; results.push({ type, id: existing!.id }); }
      else {
        const doc: PreviewDocument = { id: existing?.id ?? allocate('P'), kind: 'product', path: PRODUCT_PATH, title: str('title'), body: str('body') };
        set.documents = [doc]; results.push({ type, id: doc.id });
      }
      continue;
    }
    if (type.endsWith('-doc')) {
      const all = () => documents.filter(set => set.kind === 'guide').flatMap(set => set.documents);
      const documentPath = (kind: DocumentKind, self?: PreviewDocument) => {
        const relative = str('path'); validateDocumentRelativePath(relative); const path = `${DOCUMENT_DIRS[kind]}/${relative}`;
        if (self && self.path === path) fail(t('edit.samePath'));
        if (all().some(d => d !== self && d.path.toLowerCase() === path.toLowerCase())) fail(t('edit.documentPathExists', { path }));
        return path;
      };
      const find = () => { const id = str('id'); return all().find(d => d.id === id) ?? fail(t('edit.guideIdNotFound', { id })); };
      if (type === 'create-doc') {
        const kind: DocumentKind = 'guide';
        const doc: PreviewDocument = { id: allocate('G'), kind, path: documentPath(kind), title: str('title'), body: str('body') };
        documents.find(s => s.kind === kind)!.documents.push(doc); results.push({ type, id: doc.id });
      } else if (type === 'update-doc') {
        const doc = find(); doc.title = str('title'); doc.body = str('body'); results.push({ type, id: doc.id });
      } else if (type === 'move-doc') {
        const doc = find(); doc.path = documentPath(doc.kind, doc); results.push({ type, id: doc.id });
      } else {
        const doc = find(); const set = documents.find(s => s.kind === doc.kind)!;
        set.documents = set.documents.filter(d => d.id !== doc.id); results.push({ type, id: doc.id });
      }
      continue;
    }
    if (type === 'create') {
      const path = previewPath(str('feature'));
      if (specs.some(s => s.path.toLowerCase() === path.toLowerCase())) fail(t('edit.featureExists'));
      const spec = { id: allocate('S'), path, title: str('title'), description: str('description', true), requirements: [], history: [] };
      specs.push(spec); results.push({ type, id: spec.id });
    } else if (type === 'add') {
      const spec = target(); const req = { id: allocate('R'), title: str('title'), body: str('body') };
      spec.requirements.push(req); results.push({ type, id: req.id });
    } else if (type === 'set-design' || type === 'delete-design') {
      const spec = target();
      if (type === 'delete-design') { if (!spec.design) fail(t('edit.noDesignToDelete')); delete spec.design; }
      else spec.design = parseDesignPreview(renderDesignPreview(spec.id, {title: str('title'), body: str('body')}), spec.id);
      results.push({type, id: spec.id});
    } else if (type === 'rename-spec') {
      const spec = specs.find(s => s.id === str('id')) ?? fail(t('edit.specIdNotFound'));
      spec.title = str('title'); results.push({ type, id: spec.id });
    } else {
      const id = str('id'); const source = specs.find(s => s.requirements.some(r => r.id === id)) ?? fail(t('edit.requirementIdNotFound'));
      const req = source.requirements.find(r => r.id === id)!;
      if (type === 'move') {
        const destination = target();
        if (source === destination) fail(t('edit.sameSpec'));
        source.requirements = source.requirements.filter(r => r.id !== id); destination.requirements.push(req);
      } else { req.title = str('title'); req.body = str('body'); }
      results.push({ type, id });
    }
  }
  // Round-trip checks prevent a supplied body from injecting headings or identities.
  for (const spec of specs) {
    const parsed = parseSpecPreview(spec.path, renderSpecPreview(spec), '', spec.design ? renderDesignPreview(spec.id, spec.design) : undefined);
    if (JSON.stringify({ ...parsed, history: spec.history }) !== JSON.stringify(spec)) fail(t('edit.bodyChangesSpecStructure'));
  }
  for (const set of documents) {
    set.documents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    for (const doc of set.documents) if (JSON.stringify(parseDocument(doc.path, renderDocument(doc))) !== JSON.stringify(doc)) fail(t('edit.bodyChangesDocumentStructure', { path: doc.path }));
  }
  validateBundle({ specs, documents });
  return { specs, documents, results };
}
