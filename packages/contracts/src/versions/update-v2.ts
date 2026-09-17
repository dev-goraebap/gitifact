import { z } from 'zod';
import { updateStateV1 } from './browser-session-v2.js';

// Commit of refreshed agent-doc blocks, requested with `gitifact update --commit`.
//   not-requested  --commit was not given
//   nothing        no block file differs from HEAD
//   committed      the block-only changes were committed with the fixed message
//   skipped        a candidate could not be committed; reason says why and nothing was committed
const commitReason = z.enum(['untracked', 'other-changes', 'commit-failed']);
const agentDocsCommit = z.strictObject({
  state: z.enum(['not-requested', 'nothing', 'committed', 'skipped']),
  commit: z.string().nullable(), paths: z.array(z.string()), message: z.string().nullable(),
  reason: commitReason.nullable(), detail: z.string().nullable(),
}).refine(value => (value.state === 'committed') === (value.commit !== null) && (value.state === 'skipped') === (value.reason !== null),
  'commit is set exactly when committed, reason exactly when skipped.');

// Output of `gitifact update`: the registry check, how to install, which agent-doc blocks were refreshed and whether they were committed.
// v2 added `commit`; v1 had no consumers outside the CLI and was removed.
export const updateV2 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('update'), version: z.literal(2), ok: z.literal(true),
    cliVersion: z.string().min(1), update: updateStateV1,
    // Present only when a newer release exists. The command is for npm global installs; other installs differ.
    install: z.strictObject({ npmGlobal: z.string().min(1) }).nullable(),
    // refreshed: blocks whose version line differed were rewritten. current: every block already matched.
    // not-initialized: no .gitifact config here, so only the version check ran. no-block: no file carries a block.
    agentDocs: z.strictObject({ state: z.enum(['refreshed', 'current', 'not-initialized', 'no-block']), paths: z.array(z.string()) }),
    commit: agentDocsCommit }),
  z.strictObject({ contract: z.literal('update'), version: z.literal(2), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
export type UpdateV2 = z.infer<typeof updateV2>;
