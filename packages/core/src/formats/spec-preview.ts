// Experimental reader grammar; this is not a new project storage version.
export class SpecPreviewError extends Error {
  readonly code = 'INVALID_SPEC_PREVIEW';
}
export interface PreviewRequirement { id: string; title: string; body: string }
export interface PreviewReason { id: string; requirements: string[]; reason: string }
export interface PreviewSpec {
  id: string; path: string; title: string; description: string;
  requirements: PreviewRequirement[]; history: PreviewReason[];
}
const token = '[a-z2-7]{10}';
const reqId = new RegExp(`^R-${token}$`);
const fail = (message: string): never => { throw new SpecPreviewError(message); };
const normalized = (value: string) => value.replace(/\r\n/g, '\n').trim();

export function parseSpecPreview(path: string, source: string, history = ''): PreviewSpec {
  if (!/^\.tryce\/spec\/[^/]+\/requirements\.md$/.test(path)) fail('지원하지 않는 명세 경로: ' + path);
  if (source.includes('\0') || source.includes('\r') && /\r(?!\n)/.test(source)) fail('잘못된 명세 문자: ' + path);
  const lines = normalized(source).split('\n');
  const specMatch = new RegExp(`^<!-- tryce-spec: (S-${token}) -->$`).exec(lines[0] ?? '');
  if (!specMatch) fail('첫 줄에 유효한 tryce-spec 주석이 필요합니다: ' + path);
  let title = ''; let description = ''; let current: PreviewRequirement | undefined;
  const requirements: PreviewRequirement[] = [];
  let fence: { char: string; size: number } | undefined;
  let waitingId = false;
  const append = (line: string) => {
    if (current) current.body += line + '\n'; else description += line + '\n';
  };
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (waitingId) {
      const match = new RegExp(`^<!-- tryce-req: (R-${token}) -->$`).exec(line);
      if (!match || !current) fail('요구사항 제목 바로 아래에 유효한 ID가 필요합니다: ' + path);
      current!.id = match![1]!; waitingId = false; continue;
    }
    if (fence) {
      append(line);
      if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening) {
      if (opening[1]![0] === '`' && opening[2]!.includes('`')) fail('잘못된 코드 블록입니다.');
      fence = { char: opening[1]![0]!, size: opening[1]!.length }; append(line); continue;
    }
    if (/^# /.test(line)) {
      if (title || current || description.trim()) fail('문서 제목은 처음에 한 번만 씁니다: ' + path);
      title = line.slice(2).trim(); if (!title) fail('빈 문서 제목입니다.'); continue;
    }
    if (/^## /.test(line)) {
      if (!title) fail('문서 제목이 없습니다: ' + path);
      current = { id: '', title: line.slice(3).trim(), body: '' };
      if (!current.title) fail('빈 요구사항 제목입니다.');
      requirements.push(current); waitingId = true; continue;
    }
    // Fail closed on reserved annotations outside the supported position.
    if (line.includes('<!--') || line.includes('-->')) fail('지원하지 않는 HTML 주석 위치: ' + path);
    if (/^ {1,3}#{1,2}\s|^#{1,2}\t|^\s*(?:===+|---+)\s*$/.test(line)) fail('검토 문법은 열 1의 ATX 제목만 지원합니다: ' + path);
    append(line);
  }
  if (!title || waitingId || fence) fail('미완성 명세입니다: ' + path);
  const ids = new Set<string>();
  for (const r of requirements) {
    r.body = normalized(r.body);
    if (!r.body || ids.has(r.id)) fail('빈 본문 또는 중복 요구사항 ID: ' + r.id);
    ids.add(r.id);
  }
  return { id: specMatch![1]!, path, title, description: normalized(description), requirements, history: parsePreviewHistory(history) };
}

export function parsePreviewHistory(source: string): PreviewReason[] {
  const records: PreviewReason[] = []; const ids = new Set<string>();
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { fail('보조 기록 JSONL을 해석하지 못했습니다.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('잘못된 보조 기록입니다.');
    const r = value as Record<string, unknown>;
    if (Object.keys(r).sort().join(',') !== 'id,reason,requirements'
      || typeof r.id !== 'string' || !new RegExp(`^H-${token}$`).test(r.id)
      || ids.has(r.id) || typeof r.reason !== 'string' || !r.reason.trim()
      || !Array.isArray(r.requirements) || !r.requirements.length
      || r.requirements.some(id => typeof id !== 'string' || !reqId.test(id))
      || new Set(r.requirements).size !== r.requirements.length) fail('보조 기록의 필드·ID·대상이 잘못됐습니다.');
    ids.add(r.id as string); records.push({ id: r.id as string, requirements: r.requirements as string[], reason: r.reason as string });
  }
  return records;
}

export function validatePreviewSnapshot(specs: PreviewSpec[]): void {
  const specIds = new Set<string>(); const reqIds = new Set<string>(); const historyIds = new Set<string>();
  for (const s of specs) {
    if (specIds.has(s.id)) fail('중복 명세 ID: ' + s.id); specIds.add(s.id);
    for (const r of s.requirements) {
      if (reqIds.has(r.id)) fail('저장소 내 중복 요구사항 ID: ' + r.id); reqIds.add(r.id);
    }
    for (const h of s.history) {
      if (historyIds.has(h.id)) fail('저장소 내 중복 보조 기록 ID: ' + h.id); historyIds.add(h.id);
    }
  }
  // Old reasons may refer to requirements since deleted or moved; validate new links when comparing.
}

export function compareSpecPreviews(before: PreviewSpec[], after: PreviewSpec[]) {
  validatePreviewSnapshot(before); validatePreviewSnapshot(after);
  const index = (specs: PreviewSpec[]) => new Map(specs.flatMap(s => s.requirements.map(r => [r.id, { ...r, specId: s.id, path: s.path }] as const)));
  const prev = index(before); const next = index(after);
  const previousHistory = new Map(before.flatMap(s => s.history.map(h => [h.id, h] as const)));
  const reasons = after.flatMap(s => s.history).filter(h => {
    const old = previousHistory.get(h.id);
    if (old && JSON.stringify(old) !== JSON.stringify(h)) fail('기존 보조 기록이 변경됐습니다: ' + h.id);
    return !old;
  });
  const changes = [...new Set([...prev.keys(), ...next.keys()])].sort().flatMap(id => {
    const from = prev.get(id) ?? null; const to = next.get(id) ?? null;
    const types: ('created' | 'deleted' | 'moved' | 'modified')[] = [];
    if (!from) types.push('created'); else if (!to) types.push('deleted');
    else {
      if (from.specId !== to.specId) types.push('moved');
      if (from.title !== to.title || from.body !== to.body) types.push('modified');
    }
    return types.length ? [{ id, types, before: from, after: to, reasons: reasons.filter(h => h.requirements.includes(id)) }] : [];
  });
  const changed = new Set(changes.map(c => c.id));
  for (const h of reasons) if (h.requirements.some(id => !changed.has(id))) fail('새 보조 기록이 이번 요구사항 변경과 연결되지 않습니다: ' + h.id);
  const prevSpecs = new Map(before.map(s => [s.id, s])); const nextSpecs = new Map(after.map(s => [s.id, s]));
  const specChanges = [...new Set([...prevSpecs.keys(), ...nextSpecs.keys()])].sort().flatMap(id => {
    const from = prevSpecs.get(id); const to = nextSpecs.get(id);
    const summary = (s: PreviewSpec | undefined) => s ? { path: s.path, title: s.title, description: s.description } : null;
    const a = summary(from); const b = summary(to);
    return JSON.stringify(a) !== JSON.stringify(b) ? [{ id, before: a, after: b }] : [];
  });
  return { specChanges, changes };
}
