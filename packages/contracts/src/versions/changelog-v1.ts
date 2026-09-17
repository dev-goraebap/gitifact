import { z } from 'zod';

const items = z.array(z.string().min(1));
const entry = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  date: z.iso.date(),
  added: items,
  changed: items,
  removed: items,
  fixed: items,
}).refine(value => value.added.length + value.changed.length + value.removed.length + value.fixed.length > 0, 'A version must list at least one change.');

// Release notes for one language. fallback is true when the requested language had no notes and another was returned.
export const changelogV1 = z.strictObject({
  contract: z.literal('changelog'),
  version: z.literal(1),
  language: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  fallback: z.boolean(),
  entries: z.array(entry),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  for (const [index, item] of value.entries.entries()) {
    if (seen.has(item.version)) context.addIssue({ code: 'custom', path: ['entries', index, 'version'], message: 'Duplicate version.' });
    seen.add(item.version);
  }
});
export type ChangelogV1 = z.infer<typeof changelogV1>;
