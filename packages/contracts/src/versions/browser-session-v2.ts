import { z } from 'zod';

// latestVersion is a plain release number; a registry answer in any other shape is treated as a failed check.
const release = z.string().regex(/^\d+\.\d+\.\d+$/);
// What the local server learned about newer releases. It asks the npm registry once when the browser starts.
//   checking     the request has not finished
//   available    a release newer than the running CLI exists
//   up-to-date   the check succeeded and nothing newer exists
//   unavailable  offline, timed out or an unusable answer; never shown as "latest"
//   disabled     the check was turned off
export const updateStateV1 = z.strictObject({
  status: z.enum(['checking', 'available', 'up-to-date', 'unavailable', 'disabled']),
  latestVersion: release.nullable(),
}).refine(value => (value.status === 'available' || value.status === 'up-to-date') === (value.latestVersion !== null),
  'latestVersion is set exactly when the check produced a result.');
export type UpdateStateV1 = z.infer<typeof updateStateV1>;

export const browserSessionV2 = z.strictObject({
  contract: z.literal('browser-session'),
  version: z.literal(2),
  sessionId: z.uuid(),
  repository: z.strictObject({
    key: z.string().regex(/^repo:[0-9a-f]{64}$/),
    worktreeKey: z.string().regex(/^worktree:[0-9a-f]{64}$/),
  }),
  // The running CLI, the same value as `gitifact --version`. A development build may carry a pre-release suffix.
  cliVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  update: updateStateV1,
});
export type BrowserSessionV2 = z.infer<typeof browserSessionV2>;
