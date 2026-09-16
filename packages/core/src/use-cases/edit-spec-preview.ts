import { parseSpecPreview, renderDesignPreview, parseDesignPreview, SpecPreviewError, validatePreviewSnapshot, asBundle, validateBundle, parseDocument, renderDocument, validateDocumentRelativePath, DOCUMENT_DIRS, PRODUCT_PATH, type PreviewSpec, type PreviewBundle, type DocumentKind, type PreviewDocument } from '../formats/spec-preview.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const featurePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
export function previewPath(feature: string): string {
  if (!featurePattern.test(feature) || feature.length > 80 || reserved.test(feature)) fail('잘못된 기능 폴더 이름입니다.');
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
  if (!Array.isArray(input) || !input.length || input.length > 100) fail('operations는 1~100개여야 합니다.');
  const source = asBundle(original);
  const specs: PreviewSpec[] = source.specs.map(s => ({ ...s, requirements: s.requirements.map(r => ({ ...r })), history: s.history.map(h => ({ ...h, requirements: [...h.requirements] })) }));
  const documents = source.documents.map(set => ({ ...set, documents: set.documents.map(d => ({ ...d })), history: set.history.map(h => ({ ...h })) }));
  validateBundle({ specs, documents });
  const used = new Set([...specs.flatMap(s => [s.id, ...s.requirements.map(r => r.id)]), ...documents.flatMap(d => d.documents.map(x => x.id))]);
  const allocate = (prefix: IdPrefix) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = generate(prefix);
      if (!new RegExp(`^${prefix}-[a-z2-7]{10}$`).test(id)) fail('ID 생성 결과가 잘못됐습니다.');
      if (!used.has(id)) { used.add(id); return id; }
    }
    return fail('고유 ID를 발급하지 못했습니다.');
  };
  const results: { type: string; id: string }[] = [];
  for (const raw of input as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('잘못된 편집 입력입니다.');
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
    if (!fields || Object.keys(op).some(k => !fields.includes(k))) fail('지원하지 않는 편집 필드입니다.');
    const str = (key: string, optional = false) => {
      if (optional && op[key] === undefined) return '';
      if (typeof op[key] !== 'string' || !(op[key] as string).trim()) return fail('빈 편집 필드: ' + key);
      const value = (op[key] as string).replace(/\r\n/g, '\n').trim();
      if (value.includes('\0') || value.includes('\r') || (key !== 'body' && key !== 'description' && /[\n]/.test(value))) fail('잘못된 편집 문자: ' + key);
      return value;
    };
    const target = () => {
      const path = previewPath(str('feature'));
      return specs.find(s => s.path === path) ?? fail('대상 명세가 없습니다: ' + path);
    };
    if (type === 'set-product' || type === 'delete-product') {
      const set = documents.find(s => s.kind === 'product')!; const existing = set.documents[0];
      if (type === 'delete-product') { if (!existing) fail('삭제할 제품 문서가 없습니다.'); set.documents = []; results.push({ type, id: existing!.id }); }
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
        if (self && self.path === path) fail('이미 같은 경로입니다.');
        if (all().some(d => d !== self && d.path.toLowerCase() === path.toLowerCase())) fail('이미 존재하는 문서 경로입니다: ' + path);
        return path;
      };
      const find = () => { const id = str('id'); return all().find(d => d.id === id) ?? fail('지침 문서 ID가 없습니다: ' + id); };
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
      if (specs.some(s => s.path.toLowerCase() === path.toLowerCase())) fail('이미 존재하는 기능입니다.');
      const spec = { id: allocate('S'), path, title: str('title'), description: str('description', true), requirements: [], history: [] };
      specs.push(spec); results.push({ type, id: spec.id });
    } else if (type === 'add') {
      const spec = target(); const req = { id: allocate('R'), title: str('title'), body: str('body') };
      spec.requirements.push(req); results.push({ type, id: req.id });
    } else if (type === 'set-design' || type === 'delete-design') {
      const spec = target();
      if (type === 'delete-design') { if (!spec.design) fail('삭제할 설계가 없습니다.'); delete spec.design; }
      else spec.design = parseDesignPreview(renderDesignPreview(spec.id, {title: str('title'), body: str('body')}), spec.id);
      results.push({type, id: spec.id});
    } else if (type === 'rename-spec') {
      const spec = specs.find(s => s.id === str('id')) ?? fail('명세 ID가 없습니다.');
      spec.title = str('title'); results.push({ type, id: spec.id });
    } else {
      const id = str('id'); const source = specs.find(s => s.requirements.some(r => r.id === id)) ?? fail('요구사항 ID가 없습니다.');
      const req = source.requirements.find(r => r.id === id)!;
      if (type === 'move') {
        const destination = target();
        if (source === destination) fail('이미 같은 명세에 속합니다.');
        source.requirements = source.requirements.filter(r => r.id !== id); destination.requirements.push(req);
      } else { req.title = str('title'); req.body = str('body'); }
      results.push({ type, id });
    }
  }
  // Round-trip checks prevent a supplied body from injecting headings or identities.
  for (const spec of specs) {
    const parsed = parseSpecPreview(spec.path, renderSpecPreview(spec), '', spec.design ? renderDesignPreview(spec.id, spec.design) : undefined);
    if (JSON.stringify({ ...parsed, history: spec.history }) !== JSON.stringify(spec)) fail('본문이 명세 구조를 변경합니다.');
  }
  for (const set of documents) {
    set.documents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    for (const doc of set.documents) if (JSON.stringify(parseDocument(doc.path, renderDocument(doc))) !== JSON.stringify(doc)) fail('본문이 문서 구조를 변경합니다: ' + doc.path);
  }
  validateBundle({ specs, documents });
  return { specs, documents, results };
}
