import { z } from 'zod';

// Result of `gitifact update --later`: the newer release whose notice stays quiet until `until` (ISO 8601), or null when
// no newer release was known to postpone. A release newer than the postponed one is announced again at once.
export const updateLaterV1 = z.strictObject({
  contract: z.literal('update-later'), version: z.literal(1), ok: z.literal(true),
  cliVersion: z.string().min(1),
  later: z.strictObject({ version: z.string().min(1), until: z.iso.datetime() }).nullable(),
});
export type UpdateLaterV1 = z.infer<typeof updateLaterV1>;
