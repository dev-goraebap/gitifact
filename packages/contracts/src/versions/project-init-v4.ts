import { z } from 'zod';
export const projectInitV4 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(4), ok: z.literal(true),
    outcome: z.enum(['planned', 'created', 'already-initialized']), rootPath: z.string(), configPath: z.literal('.gitifact/config.json'),
    schemaVersion: z.literal(2),
    baseline: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('empty') }),
      z.strictObject({ kind: z.literal('commit'), objectFormat: z.enum(['sha1', 'sha256']), commit: z.string() })]),
    agentDocs: z.strictObject({ mode: z.enum(['install', 'remove', 'skip']), paths: z.array(z.string()) }) }),
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(4), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
