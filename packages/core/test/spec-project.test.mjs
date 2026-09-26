import test from 'node:test';
import assert from 'node:assert/strict';
import { formatManagedConfig, parseManagedConfig } from '../dist/index.js';
test('current schema needs schemaVersion and baseline; unknown schemas and legacy spec labels fail', () => {
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
    {schemaVersion:3},
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
test('fields this CLI does not know are allowed; cli and language are checked when present', () => {
  const empty = {kind:'empty'};
  // A later release may add a field; this one still reads the project instead of stopping.
  assert.deepEqual(parseManagedConfig(JSON.stringify({schemaVersion:3,baseline:empty,future:{a:1}})), {schemaVersion:3,baseline:empty});
  assert.deepEqual(parseManagedConfig(JSON.stringify({schemaVersion:3,baseline:empty,cli:'0.8.3',language:'en'})), {schemaVersion:3,baseline:empty,cli:'0.8.3',language:'en'});
  for (const cli of ['0.8', 'v0.8.3', '0.8.3-dev', '01.2.3', 3, null]) {
    assert.throws(()=>parseManagedConfig(JSON.stringify({schemaVersion:3,baseline:empty,cli})),{code:'INVALID_CONFIG',message:/cli/});
  }
  for (const language of ['ja', 'KO', null]) {
    assert.throws(()=>parseManagedConfig(JSON.stringify({schemaVersion:3,baseline:empty,language})),{code:'INVALID_CONFIG',message:/language/});
  }
});
test('the written config keeps a fixed field order and the fields it does not know', () => {
  const config = {schemaVersion:3,baseline:{kind:'empty'},cli:'0.8.3',language:'ko'};
  assert.equal(formatManagedConfig(config), '{\n  "schemaVersion": 3,\n  "baseline": {\n    "kind": "empty"\n  },\n  "cli": "0.8.3",\n  "language": "ko"\n}\n');
  const previous = JSON.stringify({future:true,cli:'0.8.2',baseline:{kind:'empty'},schemaVersion:3});
  assert.deepEqual(Object.keys(JSON.parse(formatManagedConfig(config, previous))), ['schemaVersion','baseline','cli','language','future']);
  assert.equal(formatManagedConfig({schemaVersion:3,baseline:{kind:'empty'}}), '{\n  "schemaVersion": 3,\n  "baseline": {\n    "kind": "empty"\n  }\n}\n');
});
