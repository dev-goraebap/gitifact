import { z } from 'zod';
import { repositoryStatusSuccessV1 } from './repository-status-v1.js';
import { projectInitV1 } from './project-init-v1.js';
import { noteV1 } from './notes-v1.js';

const error = z.strictObject({ code: z.string().min(1), message: z.string().min(1) });
export const page = <T extends z.ZodType>(item: T) => z.strictObject({ total: z.int().nonnegative(), included: z.int().nonnegative(), omitted: z.int().nonnegative(), items: z.array(item) })
  .refine(value => value.included === value.items.length && value.total === value.included + value.omitted, 'Invalid omission counts');
export const component = <T extends z.ZodType>(data: T) => z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('available'), data }),
  z.strictObject({ state: z.literal('not-available'), reason: z.string().min(1) }),
  z.strictObject({ state: z.literal('error'), error }),
]);
const init = projectInitV1.options[0];
const project = z.strictObject({ source: z.literal('working-tree'), path: z.literal('.tryce/config.json'),
  format: z.enum(['init-1', 'prototype-1']), mode: z.enum(['normal', 'prototype']), baseline: init.shape.baseline,
  baselineVerified: z.literal(true),
});
const note = noteV1.extend({ path: z.string(), textTruncated: z.boolean(), correctedBy: z.array(noteV1.shape.id) });
export const briefReportV1 = z.strictObject({
  observation: repositoryStatusSuccessV1.shape.observation,
  repository: repositoryStatusSuccessV1.shape.repository,
  git: z.strictObject({ head: repositoryStatusSuccessV1.shape.head, summary: repositoryStatusSuccessV1.shape.summary,
    changes: page(repositoryStatusSuccessV1.shape.changes.element), source: z.literal('head-index-working-tree') }),
  project: component(project), notes: component(page(note)),
  documents: component(page(z.strictObject({ path: z.string(), kind: z.enum(['instruction', 'readme', 'document']) }))),
  scope: z.strictObject({ all: z.boolean(), notes: z.literal('working-tree'), documents: z.literal('root-AGENTS-README-and-docs-markdown') }),
  checks: z.strictObject({ state: z.literal('not-run'), reason: z.literal('brief-is-observation-only') }),
  unsupported: z.array(z.enum(['requirement-state', 'task-state', 'open-questions', 'history-analysis', 'skill-discovery'])),
  followUp: z.strictObject({ complete: z.literal('tryce brief --all'), notes: z.literal('tryce note list'), note: z.literal('tryce note show <id>'), git: z.literal('tryce status') }),
});
export const briefV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('brief'), version: z.literal(1), ok: z.literal(true), report: briefReportV1 }),
  z.strictObject({ contract: z.literal('brief'), version: z.literal(1), ok: z.literal(false), error, report: briefReportV1.nullable() }),
]).refine(value => !value.ok || [value.report.project, value.report.notes, value.report.documents].every(part => part.state !== 'error'),
  'A report with unavailable inputs cannot claim success');
export type BriefV1 = z.infer<typeof briefV1>;
