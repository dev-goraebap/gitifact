import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNote, validateNoteSet } from '../dist/index.js';
const a = 'N-12345678-1234-4234-8234-123456789abc';
const b = 'N-22345678-1234-4234-8234-123456789abc';
const sample = () => ({ kind: 'tryce-note', format: 'note-1', id: a, type: 'discovery',
  recordedAt: '2026-09-13T00:00:00.000Z', text: '한글과 이모지 🐳\n근거', author: null, references: [], supersedes: null });
test('notes preserve Unicode and reject malformed or incompatible input', () => {
  assert.deepEqual(parseNote(sample()), sample());
  for (const change of [{ type: 'approve' }, { text: ' ' }, { text: '\ud800' }, { text: 'x\0y' }, { id: '../escape' },
    { author: [] }, { extra: true }, { recordedAt: '2026-02-31T00:00:00.000Z' }, { references: [a] }, { supersedes: a }]) {
    assert.throws(() => parseNote({ ...sample(), ...change }), { code: 'INVALID_NOTE' });
  }
  assert.throws(() => parseNote({ ...sample(), format: 'note-2' }), { code: 'UNSUPPORTED_NOTE_FORMAT' });
});
test('references retain originals and reject missing targets, cycles and duplicate IDs', () => {
  const first = sample(); const second = { ...sample(), id: b, references: [a], supersedes: a };
  validateNoteSet([first, second]);
  assert.throws(() => validateNoteSet([second]), { code: 'NOTE_REFERENCE_MISSING' });
  assert.throws(() => validateNoteSet([first, first]), { code: 'NOTE_ID_CONFLICT' });
  assert.throws(() => validateNoteSet([{ ...first, supersedes: b }, second]), { code: 'NOTE_CYCLE' });
});
