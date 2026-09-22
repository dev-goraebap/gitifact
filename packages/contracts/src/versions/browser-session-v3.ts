import { z } from 'zod';

// Identity of the local browser server session. v3 dropped the registry check the browser used to carry.
export const browserSessionV3 = z.strictObject({
  contract: z.literal('browser-session'),
  version: z.literal(3),
  sessionId: z.uuid(),
  repository: z.strictObject({
    key: z.string().regex(/^repo:[0-9a-f]{64}$/),
    worktreeKey: z.string().regex(/^worktree:[0-9a-f]{64}$/),
  }),
  // The running CLI, the same value as `gitifact --version`. A development build may carry a pre-release suffix.
  cliVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
});
export type BrowserSessionV3 = z.infer<typeof browserSessionV3>;
