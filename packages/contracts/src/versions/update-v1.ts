import { z } from 'zod';
import { updateStateV1 } from './browser-session-v2.js';

// Output of `gitifact update`: the registry check, how to install, and which agent-doc blocks were refreshed.
export const updateV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('update'), version: z.literal(1), ok: z.literal(true),
    cliVersion: z.string().min(1), update: updateStateV1,
    // Present only when a newer release exists. The command is for npm global installs; other installs differ.
    install: z.strictObject({ npmGlobal: z.string().min(1) }).nullable(),
    // refreshed: blocks whose version line differed were rewritten. current: every block already matched.
    // not-initialized: no .gitifact config here, so only the version check ran. no-block: no file carries a block.
    agentDocs: z.strictObject({ state: z.enum(['refreshed', 'current', 'not-initialized', 'no-block']), paths: z.array(z.string()) }) }),
  z.strictObject({ contract: z.literal('update'), version: z.literal(1), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
export type UpdateV1 = z.infer<typeof updateV1>;
