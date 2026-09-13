import { z } from 'zod';
const id = z.string().regex(/^N-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const noteV1 = z.strictObject({ kind: z.literal('tryce-note'), format: z.literal('note-1'), id,
  type: z.enum(['discovery', 'constraint', 'rejected']), recordedAt: z.iso.datetime(), text: z.string().min(1).max(16000),
  author: z.string().min(1).max(120).nullable(), references: z.array(id).max(32), supersedes: id.nullable(),
});
export const notesV1 = z.discriminatedUnion('ok', [
  z.strictObject({ contract: z.literal('notes'), version: z.literal(1), ok: z.literal(true),
    outcome: z.enum(['enabled', 'already-enabled', 'planned', 'added', 'listed', 'shown']),
    source: z.literal('working-tree'), rootPath: z.string(), notes: z.array(noteV1), backupPath: z.string().nullable(),
  }),
  z.strictObject({ contract: z.literal('notes'), version: z.literal(1), ok: z.literal(false),
    error: z.strictObject({ code: z.string(), message: z.string() }) }),
]);
