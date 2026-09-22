import { z } from 'zod';

// The browser's records in the 0.8.0 document model: every document is one file with its own ID, and a feature holds
// its requirements and design documents in `order`. v5/v3/v2 replaced the earlier versions, which carried one
// requirements.md and one design.md per feature; they had no consumers outside the CLI and were removed.

const contributor = z.strictObject({ email: z.string(), name: z.string(), commits: z.number().int().nonnegative(), latest: z.string() });
// A document the design drew on: another document by ID (its title and path resolved when it exists) or an outside page.
const source = z.strictObject({ id: z.string().optional(), title: z.string().optional(), path: z.string().optional(), url: z.string().optional(), note: z.string().optional() });
const requirement = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), order: z.number().int().nonnegative(), body: z.string() });
const design = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), order: z.number().int().nonnegative(), body: z.string(),
  requirements: z.array(z.string()), sources: z.array(source) });
const feature = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), body: z.string(),
  requirements: z.array(requirement), designs: z.array(design),
  // Authors of commits touching the feature folder and the latest such commit; empty until first committed.
  contributors: z.array(contributor), updatedAt: z.string().nullable() });
// Wiki pages from the working tree; updatedAt is the latest commit touching the path, null until committed.
const document = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), body: z.string(), updatedAt: z.string().nullable() });
// A file the cache could not read: the browser says so instead of silently leaving the document out.
const problem = z.strictObject({ code: z.string(), path: z.string(), message: z.string() });
const oid = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

/** The checkout: the current features and wiki, the contributors, and whether anything is uncommitted. */
export const browserSpecsV5 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(5), sessionId: z.string(),
  head: oid.nullable(), observedAt: z.string(), working: z.boolean(),
  features: z.array(feature), documents: z.array(document), problems: z.array(problem),
  contributors: z.array(contributor), contributorsLimited: z.boolean(),
});

const kind = z.enum(['feature', 'requirement', 'design', 'wiki']);
// What a list row needs to name a document: no body. The body comes with the change when the entry is opened.
const reference = z.strictObject({ id: z.string(), title: z.string(), specId: z.string(), path: z.string() }).nullable();
// The full document at one side of a change, as the detail shows it.
const snapshot = z.strictObject({ id: z.string(), kind, title: z.string(), description: z.string(), body: z.string(), specId: z.string(), path: z.string(),
  order: z.number().int().optional(), requirements: z.array(z.string()).optional(), sources: z.array(source).optional() }).nullable();
const changeType = z.enum(['created', 'modified', 'moved', 'deleted']);
const event = z.strictObject({ key: z.string(), commit: oid, date: z.string(), author: z.string(), email: z.string(),
  committer: z.string(), message: z.string(), id: z.string(), kind, types: z.array(changeType),
  before: reference, after: reference, reasons: z.array(z.string()) });

/** Changes matching the query over the whole history of `head`, newest first, one page of them. */
export const browserHistoryV3 = z.strictObject({
  contract: z.literal('browser-history'), version: z.literal(3), sessionId: z.string(), head: oid,
  // Matching changes in all of history, not in this page; `offset` is where this page starts among them.
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), events: z.array(event),
});
/** What the product overview draws from history: counts over all of it and its newest commits. */
export const browserHistorySummaryV2 = z.strictObject({
  contract: z.literal('browser-history-summary'), version: z.literal(2), sessionId: z.string(), head: oid,
  total: z.number().int().nonnegative(), byType: z.strictObject({ created: z.number().int().nonnegative(), modified: z.number().int().nonnegative(), moved: z.number().int().nonnegative(), deleted: z.number().int().nonnegative() }),
  // One entry per commit within three weeks of the newest change, so the reader can count by its own calendar day.
  pulse: z.array(z.strictObject({ date: z.string(), count: z.number().int().positive() })),
  // The newest commits: a few of their changes each and how many there are in all.
  recent: z.array(z.strictObject({ commit: oid, count: z.number().int().positive(), events: z.array(event) })),
});
/** One change as the list shows it, with the text on both sides; keyed `<commit>:<document id>`. */
export const browserChangeV2 = z.strictObject({
  contract: z.literal('browser-change'), version: z.literal(2), sessionId: z.string(),
  event, before: snapshot, after: snapshot,
});
/** Documents whose title, place or text holds the query: the current features and wiki, then past changes. */
export const browserSearchV1 = z.strictObject({
  contract: z.literal('browser-search'), version: z.literal(1), sessionId: z.string(), query: z.string(),
  hits: z.array(z.strictObject({
    id: z.string(), kind: z.enum(['feature', 'requirement', 'design', 'document', 'history']),
    title: z.string(), where: z.string(), line: z.string(),
    // What the hit opens: a feature (with the requirement or design tab), a wiki page, or one change in the activity.
    featureId: z.string().optional(), documentId: z.string().optional(), key: z.string().optional(),
  })),
});
export type BrowserSpecsV5 = z.infer<typeof browserSpecsV5>;
export type BrowserHistoryV3 = z.infer<typeof browserHistoryV3>;
export type BrowserHistorySummaryV2 = z.infer<typeof browserHistorySummaryV2>;
export type BrowserChangeV2 = z.infer<typeof browserChangeV2>;
export type BrowserSearchV1 = z.infer<typeof browserSearchV1>;
export type SpecEvent = z.infer<typeof event>;
export type SpecSnapshot = NonNullable<z.infer<typeof snapshot>>;
export type SpecFeature = z.infer<typeof feature>;
export type SpecRequirement = z.infer<typeof requirement>;
export type SpecDesign = z.infer<typeof design>;
export type SpecDocument = z.infer<typeof document>;
export type DesignSource = z.infer<typeof source>;

// Query strings the browser API accepts. Every value arrives as text; a key given twice is refused before these run.
const headQuery = oid;
const count = (max: number) => z.string().regex(/^(0|[1-9]\d{0,6})$/).transform(Number).pipe(z.number().int().min(0).max(max));
/** `/api/v1/history`: which HEAD, which page, and the filters, all optional but the HEAD. v3 added `id`, one document's changes. */
export const browserHistoryQueryV3 = z.strictObject({
  head: headQuery, offset: count(1_000_000).optional(), limit: count(100).pipe(z.number().min(1)).optional(),
  kind: changeType.optional(), document: kind.optional(),
  feature: z.string().regex(/^S-[a-z2-7]{10}$/).optional(), id: z.string().regex(/^[SRDW]-[a-z2-7]{10}$/).optional(), author: z.string().min(1).max(320).optional(), q: z.string().max(200).optional(),
});
export const browserHistorySummaryQueryV1 = z.strictObject({ head: headQuery });
export const browserChangeQueryV2 = z.strictObject({ key: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64}):[SRDW]-[a-z2-7]{10}$/) });
/** `/api/v1/search`: the words, and the HEAD whose history to look through (none before the first commit). */
export const browserSearchQueryV1 = z.strictObject({ q: z.string().min(1).max(200), head: headQuery.optional() });
export const changelogQueryV1 = z.strictObject({ lang: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional() });
