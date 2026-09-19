import { z } from 'zod';
const requirement = z.strictObject({ id: z.string(), title: z.string(), body: z.string() });
const contributor = z.strictObject({ email: z.string(), name: z.string(), commits: z.number().int().nonnegative(), latest: z.string() });
// A document the design drew on: a wiki page by relative link or an external URL, with an optional note.
const source = z.strictObject({ title: z.string(), path: z.string().optional(), url: z.string().optional(), note: z.string().optional() });
const feature = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), requirements: z.array(requirement),
  design: z.strictObject({title: z.string(), body: z.string(), requirements: z.array(z.string()), sources: z.array(source)}).optional(),
  // Authors of commits touching the feature folder (current or legacy store) and the latest such commit; empty until first committed.
  contributors: z.array(contributor), updatedAt: z.string().nullable() });
// Wiki pages from the working tree; updatedAt is the latest commit touching the path, null until committed.
const document = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), body: z.string(), updatedAt: z.string().nullable() });
const oid = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

/**
 * v4: the checkout alone — the current specs and wiki, the contributors, and whether anything is uncommitted.
 *
 * History left this answer. Up to v3 the checkout rode on the first page of history, and the screens filtered and
 * counted whatever pages had been loaded, so a filter answered for the loaded range only. History is now its own
 * query (`browser-history`), answered by the server over the whole of it; the checkout is bounded by the store's
 * own limits and is still sent whole.
 */
export const browserSpecsV4 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(4), sessionId: z.string(),
  head: oid.nullable(), observedAt: z.string(), working: z.boolean(),
  features: z.array(feature), documents: z.array(document),
  contributors: z.array(contributor), contributorsLimited: z.boolean(),
});

// What a list row needs to name a record: no body. The body comes with the change when the entry is opened.
const reference = z.strictObject({ id: z.string(), title: z.string(), specId: z.string(), path: z.string() }).nullable();
// The full record at one side of a change, as the detail shows it.
const snapshot = requirement.extend({ specId: z.string(), path: z.string(), sources: z.array(source).optional() }).nullable();
const changeType = z.enum(['created', 'modified', 'moved', 'deleted']);
const event = z.strictObject({ key: z.string(), commit: oid, date: z.string(), author: z.string(), email: z.string(),
  committer: z.string(), message: z.string(), id: z.string(), kind: z.enum(['requirement', 'design', 'wiki']), types: z.array(changeType),
  before: reference, after: reference, reasons: z.array(z.string()) });

/** Changes matching the query over the whole first-parent history of `head`, newest first, one page of them. */
export const browserHistoryV1 = z.strictObject({
  contract: z.literal('browser-history'), version: z.literal(1), sessionId: z.string(), head: oid,
  // Matching changes in all of history, not in this page; `offset` is where this page starts among them.
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), events: z.array(event),
  // History reaches back to records in the legacy JSON format, which it does not read.
  boundary: z.boolean(),
});
/** What the product overview draws from history: counts over all of it and its newest commits. */
export const browserHistorySummaryV1 = z.strictObject({
  contract: z.literal('browser-history-summary'), version: z.literal(1), sessionId: z.string(), head: oid,
  total: z.number().int().nonnegative(), byType: z.strictObject({ created: z.number().int().nonnegative(), modified: z.number().int().nonnegative(), moved: z.number().int().nonnegative(), deleted: z.number().int().nonnegative() }),
  // One entry per commit within three weeks of the newest change, so the reader can count by its own calendar day.
  pulse: z.array(z.strictObject({ date: z.string(), count: z.number().int().positive() })),
  // The newest commits: a few of their changes each and how many there are in all.
  recent: z.array(z.strictObject({ commit: oid, count: z.number().int().positive(), events: z.array(event) })),
});
/** One change as the list shows it, with the text on both sides; keyed `<commit>:<record id>`. */
export const browserChangeV1 = z.strictObject({
  contract: z.literal('browser-change'), version: z.literal(1), sessionId: z.string(),
  event, before: snapshot, after: snapshot,
});
/** Records whose title, place or text holds the query: the current specs and wiki, then past changes. */
export const browserSearchV1 = z.strictObject({
  contract: z.literal('browser-search'), version: z.literal(1), sessionId: z.string(), query: z.string(),
  hits: z.array(z.strictObject({
    id: z.string(), kind: z.enum(['feature', 'requirement', 'design', 'document', 'history']),
    title: z.string(), where: z.string(), line: z.string(),
    // What the hit opens: a feature (with the requirement or design tab), a wiki page, or one change in the activity.
    featureId: z.string().optional(), documentId: z.string().optional(), key: z.string().optional(),
  })),
});
export type BrowserSpecsV4 = z.infer<typeof browserSpecsV4>;
export type BrowserHistoryV1 = z.infer<typeof browserHistoryV1>;
export type BrowserHistorySummaryV1 = z.infer<typeof browserHistorySummaryV1>;
export type BrowserChangeV1 = z.infer<typeof browserChangeV1>;
export type BrowserSearchV1 = z.infer<typeof browserSearchV1>;
export type SpecEvent = z.infer<typeof event>;
export type SpecSnapshot = NonNullable<z.infer<typeof snapshot>>;
export type SpecFeature = z.infer<typeof feature>;
export type SpecDocument = z.infer<typeof document>;
export type DesignSource = z.infer<typeof source>;

// Query strings the browser API accepts. Every value arrives as text; a key given twice is refused before these run.
const headQuery = oid;
const count = (max: number) => z.string().regex(/^(0|[1-9]\d{0,6})$/).transform(Number).pipe(z.number().int().min(0).max(max));
/** `/api/v1/history`: which HEAD, which page, and the filters, all optional but the HEAD. */
export const browserHistoryQueryV1 = z.strictObject({
  head: headQuery, offset: count(1_000_000).optional(), limit: count(100).pipe(z.number().min(1)).optional(),
  kind: changeType.optional(), document: z.enum(['requirement', 'design', 'wiki']).optional(),
  feature: z.string().regex(/^S-[a-z2-7]{10}$/).optional(), author: z.string().min(1).max(320).optional(), q: z.string().max(200).optional(),
});
export const browserHistorySummaryQueryV1 = z.strictObject({ head: headQuery });
export const browserChangeQueryV1 = z.strictObject({ key: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64}):[RSW]-[a-z2-7]{10}$/) });
/** `/api/v1/search`: the words, and the HEAD whose history to look through (none before the first commit). */
export const browserSearchQueryV1 = z.strictObject({ q: z.string().min(1).max(200), head: headQuery.optional() });
export const changelogQueryV1 = z.strictObject({ lang: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional() });
