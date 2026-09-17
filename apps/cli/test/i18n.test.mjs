import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../.test-build/shared/i18n/index.js';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const catalog = JSON.parse(readFileSync(join(src, 'shared/i18n/ko/messages.json'), 'utf8'));
const sources = readdirSync(src, { recursive: true }).filter(name => name.endsWith('.ts')).map(name => readFileSync(join(src, name), 'utf8'));
const placeholders = template => [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
// Names passed in `{ a, b: expr }`, splitting only on commas outside nested calls.
const argumentNames = body => {
  const names = []; let depth = 0; let part = '';
  for (const char of body + ',') {
    if ('([{'.includes(char)) depth++;
    if (')]}'.includes(char)) depth--;
    if (char === ',' && depth === 0) { const name = /^\s*([A-Za-z_]\w*)\s*(?::|$)/.exec(part); if (name) names.push(name[1]); part = ''; }
    else part += char;
  }
  return names.sort();
};
const calls = sources.flatMap(text => [...text.matchAll(/\bt\('([^']+)'(?:, \{ ((?:[^{}]|\([^()]*\))*) \})?/g)].map(match => ({ key: match[1], names: match[2] === undefined ? [] : argumentNames(match[2]) })));

test('every message call passes exactly the placeholders its template declares', () => {
  assert.ok(calls.length > 200, String(calls.length));
  for (const { key, names } of calls) {
    assert.ok(key in catalog, 'missing key ' + key);
    assert.deepEqual(names, placeholders(catalog[key]), key);
  }
});

test('the catalog is flat and has no unused keys', () => {
  const used = new Set(calls.map(call => call.key));
  for (const [key, value] of Object.entries(catalog)) {
    assert.equal(typeof value, 'string', key);
    // docs summaries are looked up by topic through a template literal key.
    if (key.startsWith('docs.summary.')) continue;
    assert.ok(used.has(key), 'unused key ' + key);
  }
});

test('placeholders are filled like concatenation and unknown ones stay visible', () => {
  assert.equal(t('managedFile.tooLarge', { kib: 64, path: 'AGENTS.md' }), '64 KiB를 초과합니다: AGENTS.md');
  assert.equal(t('commit.busy', { path: undefined }), '이전 커밋 작업 또는 복구 자료가 있습니다: undefined');
  assert.equal(t('commit.busy'), '이전 커밋 작업 또는 복구 자료가 있습니다: {path}');
  // A value that looks like a placeholder is inserted as text, not expanded again.
  assert.equal(t('migrate.unsupportedFile', { feature: '{name}', name: 'x' }), '지원하지 않는 명세 파일입니다: .tryce/spec/{name}/x');
});

test('read error codes stay the set the repository-status contract accepts', async () => {
  // The codes moved out of the message table in core; the contract lists them separately.
  const { repositoryReadErrorCodes } = await import('@gitifact/core');
  const { repositoryStatusFailureV1 } = await import('@gitifact/contracts');
  assert.deepEqual([...repositoryReadErrorCodes].sort(), [...repositoryStatusFailureV1.shape.error.shape.code.options].sort());
});
