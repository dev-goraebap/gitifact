import { z } from 'zod';

export const projectInitV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(1), ok: z.literal(true),
    outcome: z.enum(['created', 'already-initialized', 'planned']), rootPath: z.string().min(1),
    configPath: z.literal('.tryce/config.json'), projectFormat: z.enum(['init-1', 'prototype-1']), mode: z.enum(['normal', 'prototype']),
    baseline: z.union([z.strictObject({ kind: z.literal('empty') }), z.strictObject({
      kind: z.literal('commit'), objectFormat: z.literal('sha1'), commit: z.string().regex(/^(?!0+$)[a-f0-9]{40}$/),
    }), z.strictObject({ kind: z.literal('commit'), objectFormat: z.literal('sha256'), commit: z.string().regex(/^(?!0+$)[a-f0-9]{64}$/) })]),
    hasUncommittedChanges: z.boolean(), configChanged: z.boolean(),
    integrations: z.strictObject({ skills: z.literal('not-installed-by-init'), hooks: z.literal('not-installed-by-init') }),
  }),
  z.strictObject({ contract: z.literal('project-init'), version: z.literal(1), ok: z.literal(false),
    error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }) }),
]);
