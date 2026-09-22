import { z } from 'zod';
import { updateStateV1 } from './update-state-v1.js';

// Output of `gitifact init`. v5 added the registry check (`update`, `install`) so an agent that initialises with an
// older installed CLI learns a newer release exists; v6 added the version-pinned npx command; v7 carries schemaVersion 3,
// the 0.8.0 document format, and drops the `replaced` outcome no release produces since earlier conventions stopped
// being converted. Earlier versions had no consumers outside the CLI and were removed.
export const projectInitV7 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(7), ok: z.literal(true),
    outcome: z.enum(['planned', 'created', 'already-initialized']), rootPath: z.string(), configPath: z.literal('.gitifact/config.json'),
    schemaVersion: z.literal(3),
    baseline: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('empty') }),
      z.strictObject({ kind: z.literal('commit'), objectFormat: z.enum(['sha1', 'sha256']), commit: z.string() })]),
    agentDocs: z.strictObject({ mode: z.enum(['install', 'remove', 'skip']), paths: z.array(z.string()) }),
    update: updateStateV1,
    // Present only when a newer release exists. npx refreshes the project blocks without a global install; npmGlobal remains an alternative.
    install: z.strictObject({ npx: z.string().min(1), npmGlobal: z.string().min(1) }).nullable() }),
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(7), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
export type ProjectInitV7 = z.infer<typeof projectInitV7>;
