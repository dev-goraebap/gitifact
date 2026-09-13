import { randomBytes, randomUUID } from 'node:crypto';
import { InitError, parseRequirements, requirementDocument, requirementIdPattern, requirementViews, specPattern, validText } from '@tryce/core';
import type { RequirementSet } from '@tryce/core';
import { blobHash, readRequirementSets, saveRequirementSet, workflowTransaction } from '../adapters/filesystem/workflow-store.js';
import { safeText } from '../adapters/filesystem/note-store.js';
import { readConfigFile } from '../adapters/filesystem/config-file.js';

interface Options { spec?: string; title?: string; message?: string; file?: string; author?: string; reason?: string; expected?: string; amend?: boolean; by?: string; evidence?: string }
export async function reqCommand(cwd: string, action: 'draft' | 'revise' | 'review' | 'approve' | 'activate' | 'list' | 'show', ids: string[], options: Options = {}, env = process.env, beforeWrite?: () => Promise<void>) {
  const write = !['list', 'show'].includes(action);
  return workflowTransaction(cwd, write, async c => {
    if (c.config.format !== 'workflow-1') throw new InitError('WORKFLOW_REQUIRED', 'mode set auto 또는 approval로 명시적으로 전환하세요.');
    const views = c.records.sets.flatMap(s => requirementViews(s).map(r => ({ ...r, path: `specs/${s.spec}/tryce.json` })));
    if (!write) {
      const selected = action === 'show' ? views.filter(r => ids.includes(r.requirementId)) : views;
      if (action === 'show' && !selected.length) throw new InitError('REQUIREMENT_NOT_FOUND', '요구사항을 찾을 수 없습니다.');
      await c.recheck();
      return { outcome: action, source: 'working-tree', mode: c.config.mode, items: selected, ...(action === 'show' ? { history: c.records.sets.filter(s => s.requirements.some(r => ids.includes(r.id))) } : {}) };
    }
    let spec = options.spec;
    if (['revise', 'review'].includes(action)) spec = requirementIdPattern.exec(ids[0] ?? '')?.[1];
    if (action === 'approve' || action === 'activate') spec = c.records.sets.find(s => s.reviews.some(r => r.id === ids[0]))?.spec;
    if (!spec || !specPattern.test(spec)) throw new InitError('SPEC_REQUIRED', '올바른 spec 또는 기존 요구사항·묶음 ID가 필요합니다.');
    const existing = c.records.sets.find(s => s.spec === spec);
    const set: RequirementSet = structuredClone(existing ?? { kind: 'tryce-requirements', format: 'requirements-1', spec, requirements: [], reviews: [], decisions: [] });
    const now = new Date().toISOString(); let result: unknown;
    if (action === 'draft' || action === 'revise') {
      if ((options.file === undefined) === (options.message === undefined)) throw new InitError('REQUIREMENT_INPUT_REQUIRED', '--message 또는 --file 중 하나를 지정하세요.');
      const body = options.file === undefined ? options.message : await safeText(options.file);
      if (!validText(body, 16000) || !validText(options.title, 200) || !validText(options.author, 120) || !validText(options.reason, 2000)) throw new InitError('REQUIREMENT_INPUT_REQUIRED', '본문·제목·작성자·이유가 필요합니다.');
      const revision = { id: randomUUID(), title: options.title, text: body, author: options.author, reason: options.reason, at: now };
      let req = set.requirements.find(r => r.id === ids[0]);
      if (action === 'draft') {
        const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'; const suffix = [...randomBytes(10)].map(n => alphabet[n & 31]).join('');
        req = { id: `R-${spec}-${suffix}`, revisions: [revision] }; set.requirements.push(req);
      } else {
        if (!req) throw new InitError('REQUIREMENT_NOT_FOUND', '요구사항을 찾을 수 없습니다.');
        if (req.revisions.at(-1)?.id !== options.expected) throw new InitError('STALE_REVISION', '--expected로 현재 수정본을 지정하세요.');
        if (set.decisions.some(d => set.reviews.find(r => r.id === d.review)!.items.some(i => i.id === req!.id)) && !options.amend) throw new InitError('AMEND_REQUIRED', '확정된 요구사항은 의미를 유지하는 수정에만 --amend를 사용하세요. 새 의미는 새 ID로 기록하세요.');
        req.revisions.push(revision);
      }
      result = { id: req.id, revision: revision.id, state: 'draft', approval: 'not-approved' };
    } else if (action === 'review') {
      if (!ids.length || ids.length > 32 || new Set(ids).size !== ids.length) throw new InitError('REVIEW_INPUT_REQUIRED', '같은 spec의 고유한 요구사항 1~32개를 지정하세요.');
      const items = ids.map(id => {
        const req = set.requirements.find(r => r.id === id); if (!req) throw new InitError('REQUIREMENT_NOT_FOUND', '같은 spec의 요구사항이 아닙니다: ' + id);
        const revision = req.revisions.at(-1)!; const document = requirementDocument(req, revision);
        return { id, revision: revision.id, document, blob: blobHash(document, c.first.state.repository.objectFormat) };
      });
      const review = { id: randomUUID(), at: now, items }; set.reviews.push(review); result = review;
    } else {
      const review = set.reviews.find(r => r.id === ids[0]); if (!review) throw new InitError('REVIEW_NOT_FOUND', '묶음을 찾을 수 없습니다.');
      if (!validText(options.by, 120) || !validText(options.evidence, 2000)) throw new InitError('DECISION_INPUT_REQUIRED', '실제 주체 --by와 근거 --evidence가 필요합니다.');
      if (action === 'activate' && c.config.mode !== 'auto') throw new InitError('APPROVAL_REQUIRED', '승인모드에서는 사용자 확인 후 approve를 사용하세요.');
      if (review.items.some(i => set.requirements.find(r => r.id === i.id)!.revisions.at(-1)!.id !== i.revision)) throw new InitError('STALE_REVIEW', '묶음 준비 후 내용이 변경됐습니다. 새 묶음을 보여주세요.');
      const decision = { review: review.id, kind: action === 'activate' ? 'auto' as const : 'approval' as const, actor: options.by, evidence: options.evidence, at: now, mode: c.config.mode as 'auto' | 'approval' };
      const prior = set.decisions.find(d => d.review === review.id);
      if (prior) {
        if (prior.kind !== decision.kind || prior.actor !== decision.actor || prior.evidence !== decision.evidence) throw new InitError('DECISION_CONFLICT', '이미 다른 확정 기록이 있습니다.');
        await c.recheck(); return { outcome: 'already-recorded', decision: prior };
      }
      set.decisions.push(decision); result = decision;
    }
    parseRequirements(set); await c.repo.checkIgnore(c.root, `specs/${spec}/tryce.json`);
    const expected = new Map(c.records.contents); expected.set(`specs/${spec}/tryce.json`, JSON.stringify(set, null, 2) + '\n');
    if ([...expected.values()].reduce((n, text) => n + Buffer.byteLength(text), 0) > 16 * 1024 * 1024) throw new InitError('REQUIREMENT_LIMIT', '요구사항 전체 크기 한도를 초과했습니다.');
    await beforeWrite?.();
    await saveRequirementSet(c.root, set, c.recheck, path => c.repo.checkIgnore(c.root, path), !!existing);
    if ((await c.repo.inspect()).stamp !== c.first.stamp || await readConfigFile(c.root) !== c.original) throw new InitError('INPUT_CHANGED_AFTER_WRITE', '저장 후 HEAD·index·설정이 변경됐습니다. 기록은 보존했습니다.');
    const saved = (await readRequirementSets(c.root)).contents;
    if (saved.size !== expected.size || [...expected].some(([path, text]) => saved.get(path) !== text)) throw new InitError('INPUT_CHANGED_AFTER_WRITE', '저장 중 다른 요구사항이 변경됐습니다. 현재 기록을 보존했습니다.');
    return { outcome: action, source: 'working-tree', path: `specs/${spec}/tryce.json`, result, git: 'not-committed' };
  }, env);
}
