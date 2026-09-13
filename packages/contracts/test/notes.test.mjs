import assert from 'node:assert/strict';
import test from 'node:test';
import { notesV1 } from '../dist/index.js';
test('note output carries working-tree provenance and refuses unknown contracts', () => {
  const value = { contract: 'notes', version: 1, ok: true, outcome: 'listed', source: 'working-tree', rootPath: '/repo', notes: [], backupPath: null };
  assert.deepEqual(notesV1.parse(JSON.parse(JSON.stringify(value))), value);
  for (const change of [{ source: 'committed' }, { version: 2 }, { outcome: 'approved' }]) assert.equal(notesV1.safeParse({ ...value, ...change }).success, false);
  assert.equal(notesV1.parse({ contract: 'notes', version: 1, ok: false, error: { code: 'PROJECT_BUSY', message: 'Busy' } }).ok, false);
});
