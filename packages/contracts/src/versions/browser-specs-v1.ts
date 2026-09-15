import { z } from 'zod';
const requirement = z.strictObject({ id: z.string(), title: z.string(), body: z.string() });
const feature = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), requirements: z.array(requirement), design: z.strictObject({title: z.string(), body: z.string(), requirements: z.array(z.string())}).optional() });
const snapshot = requirement.extend({ specId: z.string(), path: z.string() }).nullable();
export const browserSpecsV1 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(1), sessionId: z.string(),
  head: z.string().nullable(), observedAt: z.string(), working: z.boolean(),
  features: z.array(feature),
  events: z.array(z.strictObject({ key: z.string(), commit: z.string(), date: z.string(), author: z.string(), email: z.string(),
    committer: z.string(), message: z.string(), id: z.string(), kind: z.enum(['requirement', 'design']).optional(), types: z.array(z.enum(['created', 'modified', 'moved', 'deleted'])),
    before: snapshot, after: snapshot, reasons: z.array(z.string()) })),
  contributors: z.array(z.strictObject({ email: z.string(), name: z.string(), commits: z.number().int().nonnegative(), latest: z.string() })),
  contributorsLimited: z.boolean(), nextCursor: z.number().int().nonnegative().nullable(), boundary: z.boolean(),
});
export type BrowserSpecsV1 = z.infer<typeof browserSpecsV1>;
export type SpecEvent = BrowserSpecsV1['events'][number];
export type SpecFeature = BrowserSpecsV1['features'][number];
