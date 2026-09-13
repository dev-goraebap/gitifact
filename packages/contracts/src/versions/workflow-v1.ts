import { z } from 'zod';
export const workflowV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('workflow'), version: z.literal(1), ok: z.literal(true), command: z.string().min(1), data: z.json() }),
  z.strictObject({ contract: z.literal('workflow'), version: z.literal(1), ok: z.literal(false), command: z.string().min(1), error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }) }),
]);
