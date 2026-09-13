import assert from 'node:assert/strict';
import test from 'node:test';
import { briefNotes, briefList } from '../dist/index.js';
const note = (index, text = 'body') => ({ kind: 'tryce-note', format: 'note-1', id: `N-${String(index).padStart(8,'0')}-1234-4234-8234-123456789abc`,
  type: 'constraint', recordedAt: new Date(Date.UTC(2026, 8, 13, 0, 0, index)).toISOString(), text, author: null, references: [], supersedes: null });
test('brief counts omissions and keeps correction relations outside the selected page', () => {
  const notes = Array.from({length: 25}, (_, index) => note(index));
  // Clock order is not correction order: an older timestamp can point to a newer note.
  notes[0].supersedes = notes[24].id;
  const brief = briefNotes(notes);
  assert.equal(brief.total, 25); assert.equal(brief.included, 20); assert.equal(brief.omitted, 5);
  assert.deepEqual(brief.items[0].correctedBy, [notes[0].id]);
  assert.equal(briefNotes(notes, true).omitted, 0);
  assert.deepEqual(briefList([1,2,3], 2), {total:3, included:2, omitted:1, items:[1,2]});
});
test('preview truncation is lossless at Unicode boundaries and --all restores exact text', () => {
  const value = note(0, '🐳'.repeat(241) + '\n끝');
  const preview = briefNotes([value]).items[0];
  assert.equal(preview.text, '🐳'.repeat(240)); assert.equal(preview.textTruncated, true);
  assert.equal(briefNotes([value], true).items[0].text, value.text);
  assert.equal(briefNotes([value], true).items[0].textTruncated, false);
});
