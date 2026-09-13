import assert from 'node:assert/strict';
import test from 'node:test';
import { initialConfig, parseProjectConfig } from '../dist/index.js';

test('init format preserves empty and full commit baselines without inventing IDs', () => {
  assert.deepEqual(initialConfig('prototype', null, 'sha1'), {
    kind: 'tryce-project', format: 'init-1', mode: 'prototype', baseline: { kind: 'empty' },
  });
  for (const [format, length] of [['sha1', 40], ['sha256', 64]]) {
    const config = initialConfig('normal', 'a'.repeat(length), format);
    assert.deepEqual(parseProjectConfig(JSON.stringify(config)), config);
  }
  assert.deepEqual(initialConfig(undefined, null, 'sha1'), { kind: 'tryce-project', format: 'workflow-1', mode: 'auto', baseline: { kind: 'empty' } });
});

test('unknown formats and malformed configuration cannot be interpreted as supported', () => {
  const config = initialConfig('prototype', null, 'sha1');
  assert.throws(() => parseProjectConfig(JSON.stringify({ ...config, format: 'future' })), { code: 'UNSUPPORTED_FORMAT' });
  for (const value of [[], { ...config, format: null }, { kind: 'tryce-project' }, { ...config, mode: ['normal'] }, { ...config, extra: true }, { ...config, baseline: { kind: 'empty', commit: null } },
    { ...config, baseline: { kind: 'commit', objectFormat: 'sha1', commit: '0'.repeat(40) } },
    { ...config, baseline: { kind: 'commit', objectFormat: 'sha256', commit: 'a'.repeat(40) } }]) {
    assert.throws(() => parseProjectConfig(JSON.stringify(value)), { code: 'INVALID_CONFIG' });
  }
  assert.throws(() => parseProjectConfig('{'), { code: 'INVALID_CONFIG' });
});
