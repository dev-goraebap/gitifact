import { comparePreviewBundles, SpecPreviewError, validateBundle, asBundle, documentHistoryPath, type PreviewSpec, type PreviewReason, type PreviewBundle, type DocumentKind } from '../formats/spec-preview.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const historyPath = (s: PreviewSpec) => s.path.replace(/requirements\.md$/, 'history.jsonl');

/** Reasons written since the base commit: per feature for specs, per store folder for documents. */
export function pendingPreviewReasons(before: PreviewSpec[] | PreviewBundle, current: PreviewSpec[] | PreviewBundle) {
  const a = asBundle(before); const b = asBundle(current);
  return [
    ...b.specs.flatMap(s => s.history.slice(a.specs.find(p => p.id === s.id)?.history.length ?? 0).map(h => ({ specId: s.id, path: historyPath(s), ...h }))),
    ...b.documents.flatMap(d => d.history.slice(a.documents.find(p => p.kind === d.kind)?.history.length ?? 0).map(h => ({ kind: d.kind, path: documentHistoryPath(d.kind), ...h }))),
  ];
}

/** Strip only uncommitted reasons when computing the final requirement and document delta. */
export function finalSpecPreviewChanges(beforeValue: PreviewSpec[] | PreviewBundle, currentValue: PreviewSpec[] | PreviewBundle) {
  const before = asBundle(beforeValue); const current = asBundle(currentValue);
  validateBundle(before); validateBundle(current);
  for (const previous of before.specs) {
    const next = current.specs.find(s => s.id === previous.id);
    if (previous.history.length && !next) fail('기존 이유를 보존할 빈 명세를 남겨주세요: ' + previous.id);
    if (next && !equal(next.history.slice(0, previous.history.length), previous.history)) fail('커밋된 이유의 수정·삭제·재배치는 허용하지 않습니다: ' + previous.id);
  }
  for (const previous of before.documents) {
    const next = current.documents.find(s => s.kind === previous.kind)!;
    if (!equal(next.history.slice(0, previous.history.length), previous.history)) fail('커밋된 문서 이유의 수정·삭제·재배치는 허용하지 않습니다: ' + previous.kind);
  }
  const clean: PreviewBundle = {
    specs: current.specs.map(s => ({ ...s, history: before.specs.find(p => p.id === s.id)?.history ?? [] })),
    documents: current.documents.map(d => ({ ...d, history: before.documents.find(p => p.kind === d.kind)?.history ?? [] })),
  };
  return comparePreviewBundles(before, clean);
}

export function prepareSpecPreview(beforeValue: PreviewSpec[] | PreviewBundle, currentValue: PreviewSpec[] | PreviewBundle, baseFiles: ReadonlyMap<string, string>, currentFiles: ReadonlyMap<string, string>, input: unknown, generate: () => string) {
  const beforeBundle = asBundle(beforeValue); const currentBundle = asBundle(currentValue);
  const before = beforeBundle.specs; const current = currentBundle.specs;
  const delta = finalSpecPreviewChanges(beforeBundle, currentBundle);
  if (!Array.isArray(input) || input.length > 100) fail('reasons는 최대 100개의 배열이어야 합니다.');
  const writes = new Map<string, string | null>();
  const pending = new Map<string, PreviewReason[]>(); const covered = new Set<string>();
  const used = new Set([...before.flatMap(s => s.history), ...current.flatMap(s => s.history), ...beforeBundle.documents.flatMap(d => d.history), ...currentBundle.documents.flatMap(d => d.history)].map(h => h.id));
  const documentPending = new Map<DocumentKind, PreviewReason[]>();
  const allocate = () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = generate(); if (!/^H-[a-z2-7]{10}$/.test(id)) fail('잘못된 이유 ID 생성 결과입니다.');
      if (!used.has(id)) { used.add(id); return id; }
    }
    return fail('고유 이유 ID를 발급하지 못했습니다.');
  };
  for (const value of input as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('잘못된 이유 입력입니다.');
    const raw = value as Record<string, unknown>;
    const shape = Object.keys(raw).sort().join(',');
    if (!['reason,requirements', 'designs,reason,requirements', 'documents,reason,requirements'].includes(shape) || typeof raw.reason !== 'string' || !raw.reason.trim()
      || raw.reason.includes('\0') || raw.reason.length > 16000 || !Array.isArray(raw.requirements) || (raw.designs !== undefined && !Array.isArray(raw.designs)) || (raw.documents !== undefined && !Array.isArray(raw.documents))
      || !(raw.requirements.length || (raw.designs as unknown[] | undefined)?.length || (raw.documents as unknown[] | undefined)?.length)) fail('이유와 대상 요구사항을 확인하세요.');
    const reason = (raw.reason as string).trim(); const groups = new Map<string, string[]>();
    if (raw.documents !== undefined) {
      if ((raw.requirements as unknown[]).length) fail('문서 이유에는 요구사항을 함께 지정하지 않습니다.');
      const ids = raw.documents as unknown[]; let kind: DocumentKind | undefined;
      for (const value of ids) {
        if (typeof value !== 'string' || !/^[PG]-[a-z2-7]{10}$/.test(value) || covered.has(value)) return fail('문서 이유 대상이 잘못됐거나 중복됩니다.');
        const change = delta.changes.find(c => c.id === value) ?? fail('최종 변경이 없는 문서에 이유를 붙일 수 없습니다: ' + value);
        if (kind && change.kind !== kind) fail('한 이유는 한 종류의 문서만 대상으로 합니다.');
        kind = change.kind as DocumentKind; covered.add(value);
      }
      const documents = [...ids as string[]].sort(); const set = currentBundle.documents.find(d => d.kind === kind)!;
      const oldCount = beforeBundle.documents.find(d => d.kind === kind)?.history.length ?? 0;
      const reusable = set.history.slice(oldCount).find(h => h.reason === reason && equal([...(h.documents ?? [])].sort(), documents));
      documentPending.set(kind!, [...(documentPending.get(kind!) ?? []), { id: reusable?.id ?? allocate(), requirements: [], documents, reason }]);
      continue;
    }
    for (const value of [...raw.requirements as unknown[], ...(raw.designs as unknown[] | undefined ?? [])]) {
      if (typeof value !== 'string') fail('잘못된 이유 대상입니다.');
      const id = value as string;
      if ((raw.requirements as unknown[]).includes(id) ? !/^R-[a-z2-7]{10}$/.test(id) : !/^S-[a-z2-7]{10}$/.test(id)) fail('이유 대상 종류를 확인하세요.');
      if (typeof id !== 'string' || covered.has(id)) fail('이유 대상이 잘못됐거나 중복됩니다.');
      const change = delta.changes.find(c => c.id === id) ?? fail('최종 변경이 없는 요구사항에 이유를 붙일 수 없습니다: ' + id);
      const specId = (change.after ?? change.before)!.specId;
      if (!current.some(s => s.id === specId)) fail('삭제 이유를 기록할 원래 명세를 남겨주세요.');
      covered.add(id); groups.set(specId, [...(groups.get(specId) ?? []), id]);
    }
    for (const [specId, ids] of groups) {
      const requirements = ids.filter(id => id.startsWith('R-')).sort(); const designs = ids.filter(id => id.startsWith('S-')).sort(); const spec = current.find(s => s.id === specId)!;
      const oldCount = before.find(s => s.id === specId)?.history.length ?? 0;
      const reusable = spec.history.slice(oldCount).find(h => h.reason === reason && equal([...h.requirements].sort(), requirements) && equal([...(h.designs ?? [])].sort(), designs));
      const record = { id: reusable?.id ?? allocate(), requirements, ...(designs.length ? {designs} : {}), reason };
      pending.set(specId, [...(pending.get(specId) ?? []), record]);
    }
  }
  for (const spec of current) {
    const old = before.find(s => s.id === spec.id);
    const base = old ? baseFiles.get(historyPath(old)) : undefined;
    const records = (pending.get(spec.id) ?? []).sort((a, b) => (a.requirements[0] ?? a.designs![0]!) < (b.requirements[0] ?? b.designs![0]!) ? -1 : 1);
    // Committed bytes form the immutable prefix, including their original line endings.
    let text = base ?? '';
    if (records.length) text += (text && !text.endsWith('\n') ? '\n' : '') + records.map(h => JSON.stringify(h) + '\n').join('');
    const path = historyPath(spec);
    const next = base !== undefined || records.length ? text : null;
    if ((currentFiles.get(path) ?? null) !== next) writes.set(path, next);
  }
  for (const set of currentBundle.documents) {
    const path = documentHistoryPath(set.kind); const base = baseFiles.get(path);
    const records = (documentPending.get(set.kind) ?? []).sort((a, b) => a.documents![0]! < b.documents![0]! ? -1 : 1);
    let text = base ?? '';
    if (records.length) text += (text && !text.endsWith('\n') ? '\n' : '') + records.map(h => JSON.stringify(h) + '\n').join('');
    const next = base !== undefined || records.length ? text : null;
    if ((currentFiles.get(path) ?? null) !== next) writes.set(path, next);
  }
  return { writes, changes: delta.changes, specChanges: delta.specChanges,
    reasons: [...[...pending].flatMap(([specId, records]) => records.map(record => ({ specId, ...record }))), ...[...documentPending].flatMap(([kind, records]) => records.map(record => ({ kind, ...record })))],
    withoutReason: delta.changes.filter(c => !covered.has(c.id)).map(c => c.id) };
}
