import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManagedConfig } from '../dist/index.js';
test('current schema has only schemaVersion and baseline; unknown schemas and legacy spec labels fail', () => {
  assert.deepEqual(parseManagedConfig('{"schemaVersion":2,"baseline":{"kind":"empty"}}'), {schemaVersion:2,baseline:{kind:'empty'}});
  // The 0.4.x convention (schemaVersion 1) is named in the refusal instead of being read as if it were current.
  // It points at init, which replaces a store holding only that config; a newer convention points at updating the CLI.
  assert.throws(()=>parseManagedConfig('{"schemaVersion":1,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA',message:/schemaVersion 1.*gitifact init이 새 규약으로/});
  assert.throws(()=>parseManagedConfig('{"schemaVersion":3,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA',message:/더 새로운 저장 규약\(schemaVersion 3\).*gitifact@latest/});
  for (const value of [
    {schemaVersion:3,baseline:{kind:'empty'}},
    {schemaVersion:2,kind:'tryce-project',baseline:{kind:'empty'}},
    {kind:'tryce-project',format:'spec-1',baseline:{kind:'empty'}},
    {schemaVersion:2,baseline:{kind:'commit',objectFormat:'sha1',commit:'bad'}},
  ]) assert.throws(()=>parseManagedConfig(JSON.stringify(value)));
});
