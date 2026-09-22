import { z } from 'zod';

// latestVersion is a plain release number; a registry answer in any other shape is treated as a failed check.
const release = z.string().regex(/^\d+\.\d+\.\d+$/);
// What the CLI learned about newer releases from the npm registry (init, update and update --check).
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
