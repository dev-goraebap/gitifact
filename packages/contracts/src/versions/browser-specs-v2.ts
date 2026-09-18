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
// v2: product and guide documents became one wiki, designs carry sources, and the store moved to frontmatter IDs.
export const browserSpecsV2 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(2), sessionId: z.string(),
  head: z.string().nullable(), observedAt: z.string(), working: z.boolean(),
  features: z.array(feature),
  documents: z.array(document).default([]),
  events: z.array(z.strictObject({ key: z.string(), commit: z.string(), date: z.string(), author: z.string(), email: z.string(),
    committer: z.string(), message: z.string(), id: z.string(), kind: z.enum(['requirement', 'design', 'wiki']).optional(), types: z.array(z.enum(['created', 'modified', 'moved', 'deleted'])),
    before: snapshot, after: snapshot, reasons: z.array(z.string()) })),
  contributors: z.array(contributor),
  contributorsLimited: z.boolean(), nextCursor: z.number().int().nonnegative().nullable(), boundary: z.boolean(),
});
export type BrowserSpecsV2 = z.infer<typeof browserSpecsV2>;
export type SpecEvent = BrowserSpecsV2['events'][number];
export type SpecFeature = BrowserSpecsV2['features'][number];
export type SpecDocument = BrowserSpecsV2['documents'][number];
export type DesignSource = z.infer<typeof source>;
