import { InitError } from './project-config.js';

export const specPattern = /^[a-z][a-z0-9-]{0,39}$/;
export const requirementIdPattern = /^R-([a-z][a-z0-9-]{0,39})-([a-z2-7]{10})$/;
export interface Revision { id: string; title: string; text: string; at: string; author: string; reason: string }
export interface Requirement { id: string; revisions: Revision[] }
export interface ReviewItem { id: string; revision: string; document: string; blob: string }
export interface Review { id: string; at: string; items: ReviewItem[] }
export interface Decision { review: string; kind: 'auto' | 'approval'; actor: string; evidence: string; at: string; mode: 'auto' | 'approval' }
export interface RequirementSet { kind: 'tryce-requirements'; format: 'requirements-1'; spec: string; requirements: Requirement[]; reviews: Review[]; decisions: Decision[] }
export const requirementDocument = (r: Requirement, v: Revision) => `# ${r.id}\n\n${v.title}\n\n${v.text}\n`;
const fail = (message: string): never => { throw new InitError('INVALID_REQUIREMENTS', message); };
export const validText = (v: unknown, limit: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= limit
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF]/u.test(v);
const object = (v: unknown, fields: string[]): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== [...fields].sort().join(',')) fail('알 수 없는 필드 또는 잘못된 객체입니다.');
  return v as Record<string, unknown>;
};
const array = (v: unknown): unknown[] => { if (!Array.isArray(v) || v.length > 1000) fail('배열의 형식이나 개수 제한이 올바르지 않습니다.'); return v as unknown[]; };
const text = (v: unknown, max = 16000) => { if (!validText(v, max)) fail('빈 문자열·제어 문자·본문 제한을 확인하세요.'); return v as string; };
const uuid = (v: unknown) => { if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) fail('잘못된 수정본·묶음 ID입니다.'); };
const date = (v: unknown) => { if (typeof v !== 'string' || !/^\d{4}-.*\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail('잘못된 기록 시각입니다.'); };
export function parseRequirements(value: unknown): RequirementSet {
  const s = object(value, ['kind', 'format', 'spec', 'requirements', 'reviews', 'decisions']);
  if (s.kind !== 'tryce-requirements' || s.format !== 'requirements-1' || typeof s.spec !== 'string' || !specPattern.test(s.spec)) fail('지원하지 않는 요구사항 형식입니다.');
  const ids = new Set<string>(); const revisions = new Set<string>();
  for (const raw of array(s.requirements)) {
    const r = object(raw, ['id', 'revisions']); const id = text(r.id, 70);
    if (!requirementIdPattern.test(id) || requirementIdPattern.exec(id)?.[1] !== s.spec || ids.has(id)) fail('요구사항 ID가 중복되거나 spec과 다릅니다.');
    ids.add(id); const versions = array(r.revisions); if (!versions.length) fail('수정본이 없습니다.');
    for (const rawVersion of versions) {
      const v = object(rawVersion, ['id', 'title', 'text', 'at', 'author', 'reason']); uuid(v.id);
      if (revisions.has(String(v.id))) fail('수정본 ID가 중복됩니다.'); revisions.add(String(v.id));
      text(v.title, 200); text(v.text); text(v.author, 120); text(v.reason, 2000); date(v.at);
    }
  }
  const reviewIds = new Set<string>();
  for (const raw of array(s.reviews)) {
    const rev = object(raw, ['id', 'at', 'items']); uuid(rev.id); date(rev.at);
    if (reviewIds.has(String(rev.id))) fail('묶음 ID가 중복됩니다.'); reviewIds.add(String(rev.id));
    const items = array(rev.items); if (!items.length || items.length > 32) fail('묶음은 1~32개 요구사항입니다.');
    const seen = new Set<string>();
    for (const rawItem of items) {
      const i = object(rawItem, ['id', 'revision', 'document', 'blob']);
      const req = (s.requirements as Requirement[]).find(r => r.id === i.id); const ver = req?.revisions.find(v => v.id === i.revision);
      if (!req || !ver || seen.has(req.id) || i.document !== requirementDocument(req, ver)
        || typeof i.blob !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(i.blob)) fail('묶음 대상의 원문·참조·해시가 올바르지 않습니다.');
      seen.add(req!.id);
    }
  }
  const decisions = new Set<string>();
  for (const raw of array(s.decisions)) {
    const d = object(raw, ['review', 'kind', 'actor', 'evidence', 'at', 'mode']);
    if (!reviewIds.has(String(d.review)) || decisions.has(String(d.review)) || !['auto', 'approval'].includes(String(d.kind))
      || !['auto', 'approval'].includes(String(d.mode)) || (d.kind === 'auto' && d.mode !== 'auto')) fail('잘못된 확정·승인 관계입니다.');
    text(d.actor, 120); text(d.evidence, 2000); date(d.at); decisions.add(String(d.review));
  }
  return value as RequirementSet;
}
export function requirementViews(set: RequirementSet) {
  return set.requirements.map(r => {
    const revision = r.revisions.at(-1)!;
    const relevant = set.decisions.filter(d => set.reviews.find(v => v.id === d.review)!.items.some(i => i.id === r.id));
    const current = relevant.filter(d => set.reviews.find(v => v.id === d.review)!.items.some(i => i.id === r.id && i.revision === revision.id));
    return { ...revision, id: r.id, requirementId: r.id, revision: revision.id,
      state: current.length ? 'active' as const : 'draft' as const,
      approval: current.some(d => d.kind === 'approval') ? 'approved' as const : 'not-approved' as const,
      confirmedBefore: relevant.length > 0, decisions: current, implementation: 'not-assessed' as const, verification: 'not-run' as const };
  });
}
