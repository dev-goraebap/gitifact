import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RepositoryReadError, repositoryReadErrorCodes, docProblemCodes } from '../dist/index.js';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const catalog = JSON.parse(readFileSync(join(src, 'shared/i18n/ko/messages.json'), 'utf8'));
const sources = readdirSync(src, { recursive: true }).filter(name => name.endsWith('.ts')).map(name => readFileSync(join(src, name), 'utf8'));
const placeholders = template => [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
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
// t('key', { ... }) and the changelog parser's fail(line, 'key', { ... }) both name a catalog key directly.
const calls = sources.flatMap(text => [...text.matchAll(/\b(?:t\(|fail\((?:line|1), )'([a-zA-Z]+\.[\w.]+)'(?:, \{ ((?:[^{}]|\([^()]*\))*) \})?/g)]
  .map(match => ({ key: match[1], names: match[2] === undefined ? [] : argumentNames(match[2]) })));

test('every message call passes exactly the placeholders its template declares', () => {
  assert.ok(calls.length > 90, String(calls.length));
  for (const { key, names } of calls) {
    assert.ok(key in catalog, 'missing key ' + key);
    assert.deepEqual(names, placeholders(catalog[key]), key);
  }
});

test('the catalog is flat and has no unused keys', () => {
  const used = new Set(calls.map(call => call.key));
  for (const [key, value] of Object.entries(catalog)) {
    assert.equal(typeof value, 'string', key);
    // Read errors are looked up by code through a template literal key.
    if (key.startsWith('readError.')) { assert.ok(repositoryReadErrorCodes.includes(key.slice('readError.'.length)), key); continue; }
    // Document problems are looked up the same way, by their code.
    if (key.startsWith('doc.')) { assert.ok(docProblemCodes.includes(key.slice('doc.'.length)), key); continue; }
    assert.ok(used.has(key), 'unused key ' + key);
  }
});

test('every document problem code has a message in both languages', () => {
  const en = JSON.parse(readFileSync(join(src, 'shared/i18n/en/messages.json'), 'utf8'));
  for (const code of docProblemCodes) { assert.ok(catalog['doc.' + code], code); assert.ok(en['doc.' + code], code); }
});

test('every read error code has a message', () => {
  for (const code of repositoryReadErrorCodes) {
    const error = new RepositoryReadError(code);
    assert.equal(error.code, code);
    assert.equal(error.message, catalog['readError.' + code]);
    assert.ok(!error.message.includes('{'), code);
  }
});
