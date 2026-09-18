import { z } from 'zod';
import { updateStateV1 } from './browser-session-v2.js';

// Output of `gitifact init`. v5 added the registry check (`update`, `install`) so an agent that initialises with an
// older installed CLI learns a newer release exists, and the `replaced` outcome: a configuration of an earlier storage
// convention with no records beside it was replaced by a new one. Earlier versions had no consumers outside the CLI.
export const projectInitV5 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(5), ok: z.literal(true),
    outcome: z.enum(['planned', 'created', 'replaced', 'already-initialized']), rootPath: z.string(), configPath: z.literal('.gitifact/config.json'),
    schemaVersion: z.literal(2),
    baseline: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('empty') }),
      z.strictObject({ kind: z.literal('commit'), objectFormat: z.enum(['sha1', 'sha256']), commit: z.string() })]),
    agentDocs: z.strictObject({ mode: z.enum(['install', 'remove', 'skip']), paths: z.array(z.string()) }),
    update: updateStateV1,
    // Present only when a newer release exists. The command is for npm global installs; other installs differ.
    install: z.strictObject({ npmGlobal: z.string().min(1) }).nullable() }),
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(5), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
export type ProjectInitV5 = z.infer<typeof projectInitV5>;
