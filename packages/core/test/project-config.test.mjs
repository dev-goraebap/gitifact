import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProjectConfig } from '../dist/index.js';

// Legacy configurations are still parsed so current commands can refuse them explicitly.
const legacy = { kind: 'tryce-project', format: 'init-1', mode: 'prototype', baseline: { kind: 'empty' } };

test('legacy formats keep empty and full commit baselines without inventing IDs', () => {
  assert.deepEqual(parseProjectConfig(JSON.stringify(legacy)), legacy);
  for (const [format, length] of [['sha1', 40], ['sha256', 64]]) {
    const config = { ...legacy, mode: 'normal', baseline: { kind: 'commit', objectFormat: format, commit: 'a'.repeat(length) } };
    assert.deepEqual(parseProjectConfig(JSON.stringify(config)), config);
  }
  const workflow = { ...legacy, format: 'workflow-1', mode: 'auto' };
  assert.deepEqual(parseProjectConfig(JSON.stringify(workflow)), workflow);
});

test('unknown formats and malformed configuration cannot be interpreted as supported', () => {
  const config = legacy;
  assert.throws(() => parseProjectConfig(JSON.stringify({ ...config, format: 'future' })), { code: 'UNSUPPORTED_FORMAT' });
  for (const value of [[], { ...config, format: null }, { kind: 'tryce-project' }, { ...config, mode: ['normal'] }, { ...config, extra: true }, { ...config, baseline: { kind: 'empty', commit: null } },
    { ...config, baseline: { kind: 'commit', objectFormat: 'sha1', commit: '0'.repeat(40) } },
    { ...config, baseline: { kind: 'commit', objectFormat: 'sha256', commit: 'a'.repeat(40) } }]) {
    assert.throws(() => parseProjectConfig(JSON.stringify(value)), { code: 'INVALID_CONFIG' });
  }
  assert.throws(() => parseProjectConfig('{'), { code: 'INVALID_CONFIG' });
});
