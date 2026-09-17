import { z } from 'zod';

export const browserHttpErrorV1 = z.strictObject({
  contract: z.literal('browser-http-error'), version: z.literal(1),
  error: z.strictObject({
    code: z.enum(['BAD_REQUEST', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'SESSION_CHANGED', 'SERVER_CLOSING', 'INTERNAL_ERROR']),
    message: z.string().min(1),
  }),
});
