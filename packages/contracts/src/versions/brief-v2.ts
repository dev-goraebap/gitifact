import { z } from 'zod';
import { briefReportV1, component, page } from './brief-v1.js';
import { projectInitV2 } from './project-init-v2.js';
export const briefReportV2 = briefReportV1.extend({
  project: component(z.strictObject({ source: z.literal('working-tree'), path: z.literal('.tryce/config.json'), format: z.literal('workflow-1'), mode: z.enum(['auto', 'approval']), baseline: projectInitV2.options[0].shape.baseline, baselineVerified: z.literal(true) })),
  requirements: component(page(z.strictObject({ id: z.string(), revision: z.string(), title: z.string(), state: z.enum(['draft', 'active']), approval: z.enum(['approved', 'not-approved']), path: z.string(), implementation: z.literal('not-assessed'), verification: z.literal('not-run') }))),
});
export const briefV2 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('brief'), version: z.literal(2), ok: z.literal(true), report: briefReportV2 }),
  z.strictObject({ contract: z.literal('brief'), version: z.literal(2), ok: z.literal(false), error: z.strictObject({ code: z.string(), message: z.string() }), report: briefReportV2.nullable() }),
]).refine(v => !v.ok || [v.report.project, v.report.notes, v.report.documents, v.report.requirements].every(p => p.state !== 'error'));
export type BriefV2 = z.infer<typeof briefV2>;
