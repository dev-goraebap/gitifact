import assert from 'node:assert/strict';
import test from 'node:test';
import { changelogV1 } from '../dist/index.js';

const value = { contract: 'changelog', version: 1, language: 'ko', fallback: false, entries: [
  { version: '0.3.1', date: '2026-09-17', added: ['제품 개요'], changed: [], removed: [], fixed: [] },
  { version: '0.3.0', date: '2026-09-16', added: [], changed: [], removed: ['skills'], fixed: [] },
] };

test('changelog accepts language notes and rejects duplicates, empty versions and unknown shapes', () => {
  assert.deepEqual(changelogV1.parse(JSON.parse(JSON.stringify(value))), value);
  assert.equal(changelogV1.parse({ ...value, language: 'en', fallback: true }).fallback, true);
  const first = value.entries[0];
  for (const invalid of [{ ...value, version: 2 }, { ...value, language: 'korean' }, { ...value, extra: true },
    { ...value, entries: [first, { ...first }] },
    { ...value, entries: [{ ...first, added: [] }] },
    { ...value, entries: [{ ...first, date: '2026-02-30' }] },
    { ...value, entries: [{ ...first, version: 'v0.3.1' }] },
    { ...value, entries: [{ ...first, security: [] }] }]) assert.equal(changelogV1.safeParse(invalid).success, false);
});
