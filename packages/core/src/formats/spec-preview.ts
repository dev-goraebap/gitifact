// Experimental reader grammar; this is not a new project storage version.
export class SpecPreviewError extends Error {
  readonly code = 'INVALID_SPEC_PREVIEW';
}
export interface PreviewRequirement { id: string; title: string; body: string }
export interface PreviewReason { id: string; requirements: string[]; designs?: string[]; reason: string }
export interface PreviewDesign { title: string; body: string; requirements: string[] }
export interface PreviewSpec {
  id: string; path: string; title: string; description: string;
  requirements: PreviewRequirement[]; history: PreviewReason[]; design?: PreviewDesign;
}
const token = '[a-z2-7]{10}';
/** Current store directory; `.tryce` is read from history and legacy checkouts but never written. */
export const STORE_DIR = '.gitifact';
export const LEGACY_STORE_DIR = '.tryce';
export const STORE_DIRS = [STORE_DIR, LEGACY_STORE_DIR] as const;
/** Marker prefixes accepted on read: `gitifact-*` (current) and `tryce-*` (legacy). */
const marker = '(?:gitifact|tryce)';
/** Path of a spec record inside either store directory. */
export const recordPathPattern = /^\.(?:gitifact|tryce)\/spec\/[^/]+\/(?:requirements\.md|design\.md|history\.jsonl)$/;
/** Strips the store directory so the same feature folder compares equal across the rename. */
export const storeRelative = (path: string) => path.replace(/^\.(?:gitifact|tryce)\//, '');
const reqId = new RegExp(`^R-${token}$`);
const fail = (message: string): never => { throw new SpecPreviewError(message); };
const normalized = (value: string) => value.replace(/\r\n/g, '\n').trim();

export function renderDesignPreview(id: string, design: {title: string; body: string}): string {
  return `<!-- gitifact-design: ${id} -->\n\n# ${design.title}\n\n${design.body}\n`;
}

/** References are explicit annotations outside fenced code; prose and examples are not identifiers. */
export function parseDesignPreview(source: string, specId: string): PreviewDesign {
  if (source.includes('\0') || /\r(?!\n)/.test(source)) fail('잘못된 설계 문자입니다.');
  const lines = normalized(source).split('\n');
  if (!new RegExp(`^<!-- ${marker}-design: ${specId} -->$`).test(lines.shift() ?? '')) fail('설계의 gitifact-design ID는 같은 기능의 S-ID여야 합니다.');
  while (lines[0] === '') lines.shift();
  const heading = lines.shift();
  if (!heading?.startsWith('# ') || !heading.slice(2).trim()) fail('설계 제목이 필요합니다.');
  const title = heading!.slice(2).trim(); const raw = normalized(lines.join('\n'));
  if (!raw) fail('설계 본문이 필요합니다.');
  const references = new Set<string>(); let fence: {char: string; size: number} | undefined;
  // The parsed body carries current marker names, so a legacy `tryce-ref` read from history compares equal to its migrated form.
  const body = raw.split('\n').map(line => {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; return line; }
    if (/^#\s/.test(line)) fail('설계 최상위 제목은 하나만 씁니다.');
    if (/<!-- (?:gitifact|tryce)-/.test(line)) {
      const ref = /^<!-- (?:gitifact|tryce)-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/.exec(line);
      if (!ref) fail('설계의 참조 주석 형식을 확인하세요.');
      for (const id of ref![1]!.split(', ')) references.add(id);
      return `<!-- gitifact-ref: ${ref![1]} -->`;
    }
    return line;
  }).join('\n');
  if (fence) fail('설계 코드 블록이 닫히지 않았습니다.');
  return {title, body, requirements: [...references]};
}

export function designReferenceWarnings(specs: PreviewSpec[]) {
  const known = new Set(specs.flatMap(s => s.requirements.map(r => r.id)));
  return specs.flatMap(s => (s.design?.requirements ?? []).filter(id => !known.has(id)).map(id => ({specId: s.id, requirement: id, code: 'MISSING_DESIGN_REFERENCE' as const})));
}

export function parsePreviewFiles(files: ReadonlyMap<string, string>): PreviewSpec[] {
  const specs: PreviewSpec[] = [];
  for (const [path, source] of files) {
    if (path.endsWith('/requirements.md')) {
      specs.push(parseSpecPreview(path, source, files.get(path.replace(/requirements\.md$/, 'history.jsonl')) ?? '', files.get(path.replace(/requirements\.md$/, 'design.md'))));
    } else if (!files.has(path.replace(/(?:history\.jsonl|design\.md)$/, 'requirements.md'))) fail('요구사항 문서 없는 설계 또는 이유 파일: ' + path);
  }
  validatePreviewSnapshot(specs); return specs;
}

export function parseSpecPreview(path: string, source: string, history = '', designSource?: string): PreviewSpec {
  if (!/^\.(?:gitifact|tryce)\/spec\/[^/]+\/requirements\.md$/.test(path)) fail('지원하지 않는 명세 경로: ' + path);
  if (source.includes('\0') || source.includes('\r') && /\r(?!\n)/.test(source)) fail('잘못된 명세 문자: ' + path);
  const lines = normalized(source).split('\n');
  const specMatch = new RegExp(`^<!-- ${marker}-spec: (S-${token}) -->$`).exec(lines[0] ?? '');
  if (!specMatch) fail('첫 줄에 유효한 gitifact-spec 주석이 필요합니다: ' + path);
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
      const match = new RegExp(`^<!-- ${marker}-req: (R-${token}) -->$`).exec(line);
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
  return { id: specMatch![1]!, path, title, description: normalized(description), requirements, history: parsePreviewHistory(history), ...(designSource === undefined ? {} : { design: parseDesignPreview(designSource, specMatch![1]!) }) };
}

export function parsePreviewHistory(source: string): PreviewReason[] {
  const records: PreviewReason[] = []; const ids = new Set<string>();
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { fail('보조 기록 JSONL을 해석하지 못했습니다.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('잘못된 보조 기록입니다.');
    const r = value as Record<string, unknown>;
    if (!['id,reason,requirements', 'designs,id,reason,requirements'].includes(Object.keys(r).sort().join(','))
      || typeof r.id !== 'string' || !new RegExp(`^H-${token}$`).test(r.id)
      || ids.has(r.id) || typeof r.reason !== 'string' || !r.reason.trim()
      || !Array.isArray(r.requirements) || (!r.requirements.length && !Array.isArray(r.designs))
      || (r.designs !== undefined && (!Array.isArray(r.designs) || !r.designs.length || r.designs.some(id => typeof id !== 'string' || !/^S-[a-z2-7]{10}$/.test(id)) || new Set(r.designs).size !== r.designs.length))
      || r.requirements.some(id => typeof id !== 'string' || !reqId.test(id))
      || new Set(r.requirements).size !== r.requirements.length) fail('보조 기록의 필드·ID·대상이 잘못됐습니다.');
    ids.add(r.id as string); records.push({ id: r.id as string, requirements: r.requirements as string[], ...(r.designs === undefined ? {} : { designs: r.designs as string[] }), reason: r.reason as string });
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
  for (const [specs, map] of [[before, prev], [after, next]] as const) for (const s of specs) if (s.design) map.set(s.id, { id: s.id, title: s.design.title, body: s.design.body, specId: s.id, path: s.path.replace(/requirements\.md$/, 'design.md') });
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
      if (from.specId !== to.specId || (id.startsWith('S-') && storeRelative(from.path) !== storeRelative(to.path))) types.push('moved');
      if (from.title !== to.title || from.body !== to.body) types.push('modified');
    }
    return types.length ? [{ id, types, before: from, after: to, kind: id.startsWith('S-') ? 'design' as const : 'requirement' as const, reasons: reasons.filter(h => [...h.requirements, ...(h.designs ?? [])].includes(id)) }] : [];
  });
  const changed = new Set(changes.map(c => c.id));
  for (const h of reasons) if ([...h.requirements, ...(h.designs ?? [])].some(id => !changed.has(id))) fail('새 보조 기록이 이번 요구사항 변경과 연결되지 않습니다: ' + h.id);
  const prevSpecs = new Map(before.map(s => [s.id, s])); const nextSpecs = new Map(after.map(s => [s.id, s]));
  const specChanges = [...new Set([...prevSpecs.keys(), ...nextSpecs.keys()])].sort().flatMap(id => {
    const from = prevSpecs.get(id); const to = nextSpecs.get(id);
    const summary = (s: PreviewSpec | undefined) => s ? { path: s.path, title: s.title, description: s.description } : null;
    const a = summary(from); const b = summary(to);
    // The store rename (.tryce → .gitifact) keeps the feature folder, so it is not a spec change.
    const key = (s: ReturnType<typeof summary>) => s ? { ...s, path: storeRelative(s.path) } : null;
    return JSON.stringify(key(a)) !== JSON.stringify(key(b)) ? [{ id, before: a, after: b }] : [];
  });
  return { specChanges, changes };
}
