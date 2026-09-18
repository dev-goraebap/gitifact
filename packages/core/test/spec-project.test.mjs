import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManagedConfig } from '../dist/index.js';
test('current schema has only schemaVersion and baseline; unknown schemas and legacy spec labels fail', () => {
  assert.deepEqual(parseManagedConfig('{"schemaVersion":2,"baseline":{"kind":"empty"}}'), {schemaVersion:2,baseline:{kind:'empty'}});
  // The 0.4.x convention (schemaVersion 1) is named in the refusal instead of being read as if it were current.
  assert.throws(()=>parseManagedConfig('{"schemaVersion":1,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA'});
  for (const value of [
    {schemaVersion:3,baseline:{kind:'empty'}},
    {schemaVersion:2,kind:'tryce-project',baseline:{kind:'empty'}},
    {kind:'tryce-project',format:'spec-1',baseline:{kind:'empty'}},
    {schemaVersion:2,baseline:{kind:'commit',objectFormat:'sha1',commit:'bad'}},
  ]) assert.throws(()=>parseManagedConfig(JSON.stringify(value)));
});
