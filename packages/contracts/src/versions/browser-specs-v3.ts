import { z } from 'zod';
const requirement = z.strictObject({ id: z.string(), title: z.string(), body: z.string() });
const contributor = z.strictObject({ email: z.string(), name: z.string(), commits: z.number().int().nonnegative(), latest: z.string() });
// A document the design drew on: a wiki page by relative link or an external URL, with an optional note.
const source = z.strictObject({ title: z.string(), path: z.string().optional(), url: z.string().optional(), note: z.string().optional() });
const feature = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), requirements: z.array(requirement),
  design: z.strictObject({title: z.string(), body: z.string(), requirements: z.array(z.string()), sources: z.array(source)}).optional(),
  // Authors of commits touching the feature folder (current or legacy store) and the latest such commit; empty until first committed.
  contributors: z.array(contributor), updatedAt: z.string().nullable() });
const snapshot = requirement.extend({ specId: z.string(), path: z.string(), sources: z.array(source).optional() }).nullable();
// Wiki pages from the working tree; updatedAt is the latest commit touching the path, null until committed.
const document = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), body: z.string(), updatedAt: z.string().nullable() });
const event = z.strictObject({ key: z.string(), commit: z.string(), date: z.string(), author: z.string(), email: z.string(),
  committer: z.string(), message: z.string(), id: z.string(), kind: z.enum(['requirement', 'design', 'wiki']).optional(), types: z.array(z.enum(['created', 'modified', 'moved', 'deleted'])),
  before: snapshot, after: snapshot, reasons: z.array(z.string()) });

/**
 * v3: the checkout itself — the current specs, the wiki, the contributors and whether anything is uncommitted —
 * rides on the first page only. It describes the working tree, not the page of history, and repeating it made every
 * "load more" resend the whole store and made the server walk the log once per feature and page again. A
 * continuation page (`cursor > 0`) carries its commits and nothing else; the reader keeps the first page's copy.
 */
export const browserSpecsV3 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(3), sessionId: z.string(),
  head: z.string().nullable(), observedAt: z.string(),
  events: z.array(event),
  nextCursor: z.number().int().nonnegative().nullable(), boundary: z.boolean(),
  working: z.boolean().optional(),
  features: z.array(feature).optional(),
  documents: z.array(document).optional(),
  contributors: z.array(contributor).optional(),
  contributorsLimited: z.boolean().optional(),
});
/** The first page carries the checkout, so a reader can rely on it being there. */
export const browserSpecsFirstV3 = browserSpecsV3.required({
  working: true, features: true, documents: true, contributors: true, contributorsLimited: true,
});
export type BrowserSpecsV3 = z.infer<typeof browserSpecsV3>;
export type BrowserSpecsFirstV3 = z.infer<typeof browserSpecsFirstV3>;
export type SpecEvent = z.infer<typeof event>;
export type SpecFeature = z.infer<typeof feature>;
export type SpecDocument = z.infer<typeof document>;
export type DesignSource = z.infer<typeof source>;
