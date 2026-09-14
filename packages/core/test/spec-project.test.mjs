import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManagedConfig } from '../dist/index.js';
test('current schema has only schemaVersion and baseline; unknown schemas and legacy spec labels fail', () => {
  assert.deepEqual(parseManagedConfig('{"schemaVersion":1,"baseline":{"kind":"empty"}}'), {schemaVersion:1,baseline:{kind:'empty'}});
  for (const value of [
    {schemaVersion:2,baseline:{kind:'empty'}},
    {schemaVersion:1,kind:'tryce-project',baseline:{kind:'empty'}},
    {kind:'tryce-project',format:'spec-1',baseline:{kind:'empty'}},
    {schemaVersion:1,baseline:{kind:'commit',objectFormat:'sha1',commit:'bad'}},
  ]) assert.throws(()=>parseManagedConfig(JSON.stringify(value)));
});
