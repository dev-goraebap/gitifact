import { comparePreviewBundles, SpecPreviewError, validateBundle, WIKI_HISTORY_PATH, type PreviewSpec, type PreviewReason, type PreviewBundle } from '../formats/spec-preview.js';
import { t } from '../shared/i18n/index.js';

const fail = (message: string): never => { throw new SpecPreviewError(message); };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const historyPath = (s: PreviewSpec) => s.path.replace(/requirements\.md$/, 'history.jsonl');

/** Reasons written since the base commit: per feature for specs, one file for the wiki. */
export function pendingPreviewReasons(a: PreviewBundle, b: PreviewBundle) {
  return [
    ...b.specs.flatMap(s => s.history.slice(a.specs.find(p => p.id === s.id)?.history.length ?? 0).map(h => ({ specId: s.id, path: historyPath(s), ...h }))),
    ...b.wiki.history.slice(a.wiki.history.length).map(h => ({ kind: 'wiki' as const, path: WIKI_HISTORY_PATH, ...h })),
  ];
}

/** Strip only uncommitted reasons when computing the final requirement and wiki delta. */
export function finalSpecPreviewChanges(before: PreviewBundle, current: PreviewBundle) {
  validateBundle(before); validateBundle(current);
  for (const previous of before.specs) {
    const next = current.specs.find(s => s.id === previous.id);
    if (previous.history.length && !next) fail(t('reason.keepEmptySpec', { id: previous.id }));
    if (next && !equal(next.history.slice(0, previous.history.length), previous.history)) fail(t('reason.committedImmutable', { id: previous.id }));
  }
  if (!equal(current.wiki.history.slice(0, before.wiki.history.length), before.wiki.history)) fail(t('reason.committedDocumentImmutable'));
  const clean: PreviewBundle = {
    specs: current.specs.map(s => ({ ...s, history: before.specs.find(p => p.id === s.id)?.history ?? [] })),
    wiki: { documents: current.wiki.documents, history: before.wiki.history },
  };
  return comparePreviewBundles(before, clean);
}

export function prepareSpecPreview(beforeBundle: PreviewBundle, currentBundle: PreviewBundle, baseFiles: ReadonlyMap<string, string>, currentFiles: ReadonlyMap<string, string>, input: unknown, generate: () => string) {
  const before = beforeBundle.specs; const current = currentBundle.specs;
  const delta = finalSpecPreviewChanges(beforeBundle, currentBundle);
  if (!Array.isArray(input) || input.length > 100) fail(t('reason.count'));
  const writes = new Map<string, string | null>();
  const pending = new Map<string, PreviewReason[]>(); const covered = new Set<string>();
  const used = new Set([...before.flatMap(s => s.history), ...current.flatMap(s => s.history), ...beforeBundle.wiki.history, ...currentBundle.wiki.history].map(h => h.id));
  const wikiPending: PreviewReason[] = [];
  const allocate = () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = generate(); if (!/^H-[a-z2-7]{10}$/.test(id)) fail(t('reason.idGenerated'));
      if (!used.has(id)) { used.add(id); return id; }
    }
    return fail(t('reason.idUnavailable'));
  };
  for (const value of input as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(t('reason.invalidInput'));
    const raw = value as Record<string, unknown>;
    const shape = Object.keys(raw).sort().join(',');
    if (!['reason,requirements', 'designs,reason,requirements', 'documents,reason,requirements'].includes(shape) || typeof raw.reason !== 'string' || !raw.reason.trim()
      || raw.reason.includes('\0') || raw.reason.length > 16000 || !Array.isArray(raw.requirements) || (raw.designs !== undefined && !Array.isArray(raw.designs)) || (raw.documents !== undefined && !Array.isArray(raw.documents))
      || !(raw.requirements.length || (raw.designs as unknown[] | undefined)?.length || (raw.documents as unknown[] | undefined)?.length)) fail(t('reason.targetsRequired'));
    const reason = (raw.reason as string).trim(); const groups = new Map<string, string[]>();
    if (raw.documents !== undefined) {
      if ((raw.requirements as unknown[]).length) fail(t('reason.documentWithRequirements'));
      const ids = raw.documents as unknown[];
      for (const value of ids) {
        if (typeof value !== 'string' || !/^W-[a-z2-7]{10}$/.test(value) || covered.has(value)) return fail(t('reason.documentTargetInvalid'));
        if (!delta.changes.some(c => c.id === value)) fail(t('reason.documentUnchanged', { id: value }));
        covered.add(value);
      }
      const documents = [...ids as string[]].sort();
      const reusable = currentBundle.wiki.history.slice(beforeBundle.wiki.history.length).find(h => h.reason === reason && equal([...(h.documents ?? [])].sort(), documents));
      wikiPending.push({ id: reusable?.id ?? allocate(), requirements: [], documents, reason });
      continue;
    }
    for (const value of [...raw.requirements as unknown[], ...(raw.designs as unknown[] | undefined ?? [])]) {
      if (typeof value !== 'string') fail(t('reason.invalidTarget'));
      const id = value as string;
      if ((raw.requirements as unknown[]).includes(id) ? !/^R-[a-z2-7]{10}$/.test(id) : !/^S-[a-z2-7]{10}$/.test(id)) fail(t('reason.targetKind'));
      if (typeof id !== 'string' || covered.has(id)) fail(t('reason.targetInvalid'));
      const change = delta.changes.find(c => c.id === id) ?? fail(t('reason.requirementUnchanged', { id }));
      const specId = (change.after ?? change.before)!.specId;
      if (!current.some(s => s.id === specId)) fail(t('reason.keepDeletedSpec'));
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
  const historyText = (base: string | undefined, records: PreviewReason[]) => {
    // Committed bytes form the immutable prefix, including their original line endings.
    let text = base ?? '';
    if (records.length) text += (text && !text.endsWith('\n') ? '\n' : '') + records.map(h => JSON.stringify(h) + '\n').join('');
    return base !== undefined || records.length ? text : null;
  };
  for (const spec of current) {
    const old = before.find(s => s.id === spec.id);
    const base = old ? baseFiles.get(historyPath(old)) : undefined;
    const records = (pending.get(spec.id) ?? []).sort((a, b) => (a.requirements[0] ?? a.designs![0]!) < (b.requirements[0] ?? b.designs![0]!) ? -1 : 1);
    const path = historyPath(spec); const next = historyText(base, records);
    if ((currentFiles.get(path) ?? null) !== next) writes.set(path, next);
  }
  {
    const records = wikiPending.sort((a, b) => a.documents![0]! < b.documents![0]! ? -1 : 1);
    const next = historyText(baseFiles.get(WIKI_HISTORY_PATH), records);
    if ((currentFiles.get(WIKI_HISTORY_PATH) ?? null) !== next) writes.set(WIKI_HISTORY_PATH, next);
  }
  return { writes, changes: delta.changes, specChanges: delta.specChanges,
    reasons: [...[...pending].flatMap(([specId, records]) => records.map(record => ({ specId, ...record }))), ...wikiPending.map(record => ({ kind: 'wiki' as const, ...record }))],
    withoutReason: delta.changes.filter(c => !covered.has(c.id)).map(c => c.id) };
}
