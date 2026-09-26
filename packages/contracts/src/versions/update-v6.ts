import { z } from 'zod';
import { updateStateV1 } from './update-state-v1.js';

// Commit of the update, requested with `gitifact update --commit`.
//   not-requested  --commit was not given
//   nothing        no block file or config differs from HEAD
//   committed      the block-only and cli/language-only changes were committed with the fixed message
//   skipped        a candidate could not be committed; reason says why and nothing was committed
const commitReason = z.enum(['untracked', 'other-changes', 'commit-failed']);
const updateCommit = z.strictObject({
  state: z.enum(['not-requested', 'nothing', 'committed', 'skipped']),
  commit: z.string().nullable(), paths: z.array(z.string()), message: z.string().nullable(),
  reason: commitReason.nullable(), detail: z.string().nullable(),
}).refine(value => (value.state === 'committed') === (value.commit !== null) && (value.state === 'skipped') === (value.reason !== null),
  'commit is set exactly when committed, reason exactly when skipped.');

// Output of `gitifact update`: the registry check, how to install, which agent-doc blocks were refreshed, the project's
// release in the config and whether it was all committed. v2 added `commit`, v3 `agentDocs.missing`, v4 the version-pinned
// npx command, v5 `migrationRequired`, v6 `project` and a global install as the only install command. Earlier versions had
// no consumers outside the CLI and were removed.
export const updateV6 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('update'), version: z.literal(6), ok: z.literal(true),
    cliVersion: z.string().min(1), update: updateStateV1,
    // Present only when a newer release exists; after installing it, `gitifact update` sets the project to it.
    install: z.strictObject({ npmGlobal: z.string().min(1) }).nullable(),
    // refreshed: blocks whose text differed were rewritten. current: every block already matched. kept: the project is on a
    // release newer than this CLI, so its blocks were left as they are.
    // not-initialized: no .gitifact config here, so only the version check ran. no-block: no file carries a block.
    // missing: files `gitifact init` would add and update does not create, e.g. CLAUDE.md when only AGENTS.md has the block.
    agentDocs: z.strictObject({ state: z.enum(['refreshed', 'current', 'kept', 'not-initialized', 'no-block']), paths: z.array(z.string()), missing: z.array(z.string()) }),
    // written: .gitifact/config.json now names this release as `cli` and the block language. current: it already did.
    // cli is the project's release afterwards; one newer than cliVersion was kept, since an older CLI does not lower it.
    project: z.strictObject({ state: z.enum(['written', 'current', 'not-initialized']), cli: z.string().min(1).nullable() }),
    commit: updateCommit,
    // The project still uses the 0.7 storage convention (schemaVersion 2): the blocks now describe commands that will refuse it
    // until the documents are moved with `gitifact guide show migrate`.
    migrationRequired: z.boolean() }),
  z.strictObject({ contract: z.literal('update'), version: z.literal(6), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
export type UpdateV6 = z.infer<typeof updateV6>;
