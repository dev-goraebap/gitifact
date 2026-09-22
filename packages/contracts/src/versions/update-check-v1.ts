import { z } from 'zod';
import { updateStateV1 } from './update-state-v1.js';

// Read-only result of `update --check`; it does not inspect or refresh project files.
export const updateCheckV1 = z.strictObject({
  contract: z.literal('update-check'), version: z.literal(1), ok: z.literal(true),
  cliVersion: z.string().min(1),
  update: updateStateV1.refine(value => value.status !== 'checking', 'The check must have finished.'),
  command: z.string().min(1).nullable(),
}).refine(value => (value.update.status === 'available') === (value.command !== null),
  'An update command is present exactly when a newer release is available.');
export type UpdateCheckV1 = z.infer<typeof updateCheckV1>;
