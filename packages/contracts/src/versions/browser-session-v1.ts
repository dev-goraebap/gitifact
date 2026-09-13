import { z } from 'zod';

export const browserSessionV1 = z.strictObject({
  contract: z.literal('browser-session'),
  version: z.literal(1),
  sessionId: z.uuid(),
  repository: z.strictObject({
    key: z.string().regex(/^repo:[0-9a-f]{64}$/),
    worktreeKey: z.string().regex(/^worktree:[0-9a-f]{64}$/),
  }),
});
export type BrowserSessionV1 = z.infer<typeof browserSessionV1>;
export const browserHttpErrorV1 = z.strictObject({
  contract: z.literal('browser-http-error'), version: z.literal(1),
  error: z.strictObject({
    code: z.enum(['BAD_REQUEST', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'SESSION_CHANGED', 'SERVER_CLOSING', 'INTERNAL_ERROR']),
    message: z.string().min(1),
  }),
});
