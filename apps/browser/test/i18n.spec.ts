import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Static checks on the message catalog; no page is opened.
const src = fileURLToPath(new URL('../src/', import.meta.url));
const catalog = JSON.parse(readFileSync(join(src, 'shared/i18n/ko/messages.json'), 'utf8')) as Record<string, unknown>;
const sources = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith('.gen.ts'))
  .map(name => readFileSync(join(src, name), 'utf8'));

const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort();

// Reads `t('key')`, `t('key', { a, b: expr })` and `tNodes('key', { time: <time>{x}</time> })`, where values may hold JSX.
function calls(text: string) {
  const found: { key: string; names: string[] }[] = [];
  for (const match of text.matchAll(/\b(?:t|tNodes)\('([\w.]+)'/g)) {
    let index = match.index + match[0].length;
    const names: string[] = [];
    if (text.startsWith(', {', index)) {
      index += 3; let depth = 0; let part = '';
      for (; index < text.length; index++) {
        const char = text[index]!;
        if (depth === 0 && (char === ',' || char === '}')) {
          const name = /^\s*([A-Za-z_]\w*)\s*(?::|$)/.exec(part);
          if (name) names.push(name[1]!);
          part = '';
          if (char === '}') break;
          continue;
        }
        if ('([{'.includes(char)) depth++;
        if (')]}'.includes(char)) depth--;
        part += char;
      }
    }
    found.push({ key: match[1]!, names: names.sort() });
  }
  return found;
}
const used = sources.flatMap(calls);

test('every message call passes exactly the placeholders its template declares', () => {
  expect(used.length).toBeGreaterThan(180);
  for (const { key, names } of used) {
    expect(Object.hasOwn(catalog, key), 'missing key ' + key).toBe(true);
    expect(names, key).toEqual(placeholders(catalog[key] as string));
  }
});

test('the catalog is flat and has no unused keys', () => {
  const keys = new Set(used.map(call => call.key));
  for (const [key, value] of Object.entries(catalog)) {
    expect(typeof value, key).toBe('string');
    expect(keys.has(key), 'unused key ' + key).toBe(true);
  }
});
