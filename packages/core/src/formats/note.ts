import { InitError } from './project-config.js';

export const noteIdPattern = /^N-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type NoteType = 'discovery' | 'constraint' | 'rejected';
export interface Note {
  kind: 'tryce-note'; format: 'note-1'; id: string; type: NoteType;
  recordedAt: string; text: string; author: string | null; references: string[]; supersedes: string | null;
}
const plainText = (value: unknown, limit: number): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF]/u.test(value);
export function parseNote(value: unknown): Note {
  const fail = (): never => { throw new InitError('INVALID_NOTE', '기록의 형식·ID·본문·참조가 올바르지 않습니다.'); };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail();
  const n = value as Record<string, unknown>;
  if (n.kind === 'tryce-note' && typeof n.format === 'string' && n.format !== 'note-1') throw new InitError('UNSUPPORTED_NOTE_FORMAT', '지원하지 않는 기록 형식입니다.');
  if (Object.keys(n).sort().join(',') !== 'author,format,id,kind,recordedAt,references,supersedes,text,type'
    || n.kind !== 'tryce-note' || n.format !== 'note-1' || typeof n.id !== 'string' || !noteIdPattern.test(n.id)
    || typeof n.type !== 'string' || !['discovery', 'constraint', 'rejected'].includes(n.type)
    || !plainText(n.text, 16000) || (n.author !== null && !plainText(n.author, 120))
    || typeof n.recordedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(n.recordedAt)
    || !Number.isFinite(Date.parse(n.recordedAt)) || new Date(n.recordedAt).toISOString() !== n.recordedAt
    || !Array.isArray(n.references) || n.references.length > 32 || new Set(n.references).size !== n.references.length
    || n.references.some(id => typeof id !== 'string' || !noteIdPattern.test(id) || id === n.id)
    || (n.supersedes !== null && (typeof n.supersedes !== 'string' || !noteIdPattern.test(n.supersedes) || n.supersedes === n.id))) return fail();
  return n as unknown as Note;
}

export function validateNoteSet(notes: Note[]) {
  const byId = new Map(notes.map(note => [note.id, note]));
  if (byId.size !== notes.length) throw new InitError('NOTE_ID_CONFLICT', '같은 ID의 기록이 여러 개입니다.');
  for (const note of notes) for (const id of [...note.references, ...(note.supersedes ? [note.supersedes] : [])]) {
    if (!byId.has(id)) throw new InitError('NOTE_REFERENCE_MISSING', '참조한 기록을 찾을 수 없습니다: ' + id);
  }
  // Corrections form chains; concurrent corrections are kept as separate branches.
  for (const note of notes) {
    const seen = new Set<string>(); let current: Note | undefined = note;
    while (current) {
      if (seen.has(current.id)) throw new InitError('NOTE_CYCLE', '정정 참조가 순환합니다.');
      seen.add(current.id); current = current.supersedes ? byId.get(current.supersedes) : undefined;
    }
  }
}
