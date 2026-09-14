import { compareSpecPreviews, SpecPreviewError, validatePreviewSnapshot, type PreviewSpec, type PreviewReason } from '../formats/spec-preview.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const historyPath = (s: PreviewSpec) => s.path.replace(/requirements\.md$/, 'history.jsonl');

/** Strip only uncommitted reasons when computing the final requirement delta. */
export function finalSpecPreviewChanges(before: PreviewSpec[], current: PreviewSpec[]) {
  validatePreviewSnapshot(before); validatePreviewSnapshot(current);
  for (const previous of before) {
    const next = current.find(s => s.id === previous.id);
    if (previous.history.length && !next) fail('기존 이유를 보존할 빈 명세를 남겨주세요: ' + previous.id);
    if (next && !equal(next.history.slice(0, previous.history.length), previous.history)) fail('커밋된 이유의 수정·삭제·재배치는 허용하지 않습니다: ' + previous.id);
  }
  const clean = current.map(s => ({ ...s, history: before.find(p => p.id === s.id)?.history ?? [] }));
  return compareSpecPreviews(before, clean);
}

export function prepareSpecPreview(before: PreviewSpec[], current: PreviewSpec[], baseFiles: ReadonlyMap<string, string>, currentFiles: ReadonlyMap<string, string>, input: unknown, generate: () => string) {
  const delta = finalSpecPreviewChanges(before, current);
  if (!Array.isArray(input) || input.length > 100) fail('reasons는 최대 100개의 배열이어야 합니다.');
  const writes = new Map<string, string | null>();
  const pending = new Map<string, PreviewReason[]>(); const covered = new Set<string>();
  const used = new Set([...before, ...current].flatMap(s => s.history.map(h => h.id)));
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
    if (Object.keys(raw).sort().join(',') !== 'reason,requirements' || typeof raw.reason !== 'string' || !raw.reason.trim()
      || raw.reason.includes('\0') || raw.reason.length > 16000 || !Array.isArray(raw.requirements) || !raw.requirements.length) fail('이유와 대상 요구사항을 확인하세요.');
    const reason = (raw.reason as string).trim(); const groups = new Map<string, string[]>();
    for (const value of raw.requirements as unknown[]) {
      if (typeof value !== 'string') fail('잘못된 이유 대상입니다.');
      const id = value as string;
      if (typeof id !== 'string' || covered.has(id)) fail('이유 대상이 잘못됐거나 중복됩니다.');
      const change = delta.changes.find(c => c.id === id) ?? fail('최종 변경이 없는 요구사항에 이유를 붙일 수 없습니다: ' + id);
      const specId = (change.after ?? change.before)!.specId;
      if (!current.some(s => s.id === specId)) fail('삭제 이유를 기록할 원래 명세를 남겨주세요.');
      covered.add(id); groups.set(specId, [...(groups.get(specId) ?? []), id]);
    }
    for (const [specId, ids] of groups) {
      const requirements = ids.sort(); const spec = current.find(s => s.id === specId)!;
      const oldCount = before.find(s => s.id === specId)?.history.length ?? 0;
      const reusable = spec.history.slice(oldCount).find(h => h.reason === reason && equal([...h.requirements].sort(), requirements));
      const record = { id: reusable?.id ?? allocate(), requirements, reason };
      pending.set(specId, [...(pending.get(specId) ?? []), record]);
    }
  }
  for (const spec of current) {
    const old = before.find(s => s.id === spec.id);
    const base = old ? baseFiles.get(historyPath(old)) : undefined;
    const records = (pending.get(spec.id) ?? []).sort((a, b) => a.requirements[0]! < b.requirements[0]! ? -1 : 1);
    // Committed bytes form the immutable prefix, including their original line endings.
    let text = base ?? '';
    if (records.length) text += (text && !text.endsWith('\n') ? '\n' : '') + records.map(h => JSON.stringify(h) + '\n').join('');
    const path = historyPath(spec);
    const next = base !== undefined || records.length ? text : null;
    if ((currentFiles.get(path) ?? null) !== next) writes.set(path, next);
  }
  return { writes, changes: delta.changes, specChanges: delta.specChanges,
    reasons: [...pending].flatMap(([specId, records]) => records.map(record => ({ specId, ...record }))),
    withoutReason: delta.changes.filter(c => !covered.has(c.id)).map(c => c.id) };
}
