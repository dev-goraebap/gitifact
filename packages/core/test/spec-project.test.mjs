import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManagedConfig } from '../dist/index.js';
test('current schema has only schemaVersion and baseline; unknown schemas and legacy spec labels fail', () => {
  assert.deepEqual(parseManagedConfig('{"schemaVersion":3,"baseline":{"kind":"empty"}}'), {schemaVersion:3,baseline:{kind:'empty'}});
  // An earlier convention is named in the refusal instead of being read as if it were current; a newer one points at updating the CLI.
  assert.throws(()=>parseManagedConfig('{"schemaVersion":1,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA',message:/schemaVersion 1/});
  // The 0.7 convention, the one a migration starts from, points at the migration guide.
  assert.throws(()=>parseManagedConfig('{"schemaVersion":2,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA',message:/schemaVersion 2.*guide show migrate/});
  assert.throws(()=>parseManagedConfig('{"schemaVersion":4,"baseline":{"kind":"empty"}}'),{code:'UNSUPPORTED_SCHEMA',message:/더 새로운 저장 규약\(schemaVersion 4\).*gitifact@latest/});
  // Tryce configurations had no schemaVersion and are no longer read.
  assert.throws(()=>parseManagedConfig(JSON.stringify({kind:'tryce-project',format:'init-1',mode:'normal',baseline:{kind:'empty'}})),{code:'UNSUPPORTED_FORMAT'});
  for (const value of [
    {schemaVersion:4,baseline:{kind:'empty'}},
    {schemaVersion:3,kind:'tryce-project',baseline:{kind:'empty'}},
    {kind:'tryce-project',format:'spec-1',baseline:{kind:'empty'}},
    {schemaVersion:3,baseline:{kind:'commit',objectFormat:'sha1',commit:'bad'}},
  ]) assert.throws(()=>parseManagedConfig(JSON.stringify(value)));
  assert.throws(()=>parseManagedConfig('{'),{code:'INVALID_CONFIG'});
});
test('commit baselines keep the object format and reject malformed or zero hashes', () => {
  for (const [format, length] of [['sha1', 40], ['sha256', 64]]) {
    const baseline = {kind:'commit',objectFormat:format,commit:'a'.repeat(length)};
    assert.deepEqual(parseManagedConfig(JSON.stringify({schemaVersion:3,baseline})), {schemaVersion:3,baseline});
    for (const bad of [{...baseline,commit:'0'.repeat(length)},{...baseline,commit:'a'.repeat(length+1)},{...baseline,extra:true},{kind:'empty',extra:true},{kind:'other'}]) {
      assert.throws(()=>parseManagedConfig(JSON.stringify({schemaVersion:3,baseline:bad})),{code:'INVALID_CONFIG'});
    }
  }
});
