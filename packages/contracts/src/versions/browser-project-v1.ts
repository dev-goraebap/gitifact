import { z } from 'zod';
import { briefV1, component } from './brief-v1.js';
import { briefV2 } from './brief-v2.js';

const revision = z.strictObject({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  author: z.string(),
  reason: z.string(),
  at: z.iso.datetime(),
});
const review = z.strictObject({
  id: z.string(),
  at: z.iso.datetime(),
  items: z.array(
    z.strictObject({ id: z.string(), revision: z.string(), document: z.string(), blob: z.string() }),
  ),
});
const decision = z.strictObject({
  review: z.string(),
  kind: z.enum(['auto', 'approval']),
  actor: z.string(),
  evidence: z.string(),
  at: z.iso.datetime(),
  mode: z.enum(['auto', 'approval']),
});
export const browserRequirementV1 = z.strictObject({
  id: z.string(),
  spec: z.string(),
  path: z.string(),
  title: z.string(),
  text: z.string(),
  state: z.enum(['draft', 'active']),
  approval: z.enum(['approved', 'not-approved']),
  implementation: z.literal('not-assessed'),
  verification: z.literal('not-run'),
  revisions: z.array(revision),
  reviews: z.array(review),
  decisions: z.array(decision),
});
export const browserProjectV1 = z.strictObject({
  contract: z.literal('browser-project'),
  version: z.literal(1),
  brief: z.union([briefV1, briefV2]),
  requirements: component(z.array(browserRequirementV1)),
});
export type BrowserProjectV1 = z.infer<typeof browserProjectV1>;
export type BrowserRequirementV1 = z.infer<typeof browserRequirementV1>;
