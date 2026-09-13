import { z } from 'zod';
export const skillsV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('skills'), version: z.literal(1), ok: z.literal(true),
    outcome: z.enum(['planned', 'installed', 'synced', 'removed', 'not-installed']), rootPath: z.string(),
    agent: z.enum(['codex', 'claude']).nullable(), source: z.literal('.agents/skills/tryce-workflow/SKILL.md'),
    target: z.literal('.claude/skills/tryce-workflow/SKILL.md').nullable(), sourcePreserved: z.boolean(), sessionState: z.literal('not-observed') }),
  z.strictObject({ contract: z.literal('skills'), version: z.literal(1), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
