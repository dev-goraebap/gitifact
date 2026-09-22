import { DocumentError } from '../domain/document.js';
import { t } from '../shared/i18n/index.js';

// A YAML frontmatter block, reading only the subset Gitifact writes: `key: value` scalars, lists of scalars and lists
// of flat maps. Anything else fails, so a hand edit is never read as something it is not. The renderer writes the same
// subset back, so a parsed file renders to the same bytes when it was already canonical.

export type FrontValue = { type: 'scalar'; value: string } | { type: 'list'; items: string[] } | { type: 'maps'; items: Record<string, string>[] };
export type FrontFields = Map<string, FrontValue>;

// Plain, or double-quoted with \" and \\ escapes. A plain value may not start with YAML indicators or hold `: `/` #`.
function scalar(value: string, path: string): string {
  const quoted = /^"((?:[^"\\]|\\["\\])*)"$/.exec(value);
  if (quoted) return quoted[1]!.replace(/\\(["\\])/g, '$1');
  if (!value || /^["'#&*!|>%@`[{-]/.test(value) || /:\s|\s#/.test(value) || value !== value.trim()) throw new DocumentError('FRONTMATTER_VALUE', path, t('doc.FRONTMATTER_VALUE', { path, value }));
  return value;
}
/** Plain when `scalar` reads it back unchanged and YAML would not read it as a number or boolean; otherwise quoted. */
export function quoteScalar(value: string): string {
  const plain = /^[A-Za-z0-9가-힣./_][^"#\\]*$/.test(value) && value === value.trim() && !/\s#|:\s|:$/.test(value)
    && !/^(true|false|null|yes|no|on|off|~)$/i.test(value) && !/^[\d.+-]/.test(value);
  return plain ? value : '"' + value.replace(/[\\"]/g, '\\$&') + '"';
}

/** Splits a normalized (LF) source into its frontmatter fields and the body after the closing `---`. */
export function parseFrontmatterBlock(source: string, path: string): { fields: FrontFields; body: string } {
  const lines = source.split('\n');
  if (lines[0] !== '---') throw new DocumentError('FRONTMATTER_REQUIRED', path, t('doc.FRONTMATTER_REQUIRED', { path }));
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new DocumentError('FRONTMATTER_UNCLOSED', path, t('doc.FRONTMATTER_UNCLOSED', { path }));
  const block = lines.slice(1, end);
  const fields: FrontFields = new Map();
  const bad = (line: string) => new DocumentError('FRONTMATTER_LINE', path, t('doc.FRONTMATTER_LINE', { path, line }));
  for (let i = 0; i < block.length; i++) {
    const line = block[i]!;
    if (!line.trim()) continue;
    const entry = /^([a-z][a-zA-Z]*):(?: (.*))?$/.exec(line);
    if (!entry || fields.has(entry[1]!)) throw bad(line);
    const [, key, value] = entry;
    if (value !== undefined) { fields.set(key!, { type: 'scalar', value: scalar(value, path) }); continue; }
    // A key without a value opens a list; its items are indented by two spaces.
    const scalars: string[] = []; const maps: Record<string, string>[] = [];
    while (i + 1 < block.length && block[i + 1]!.startsWith('  ')) {
      const item = block[++i]!;
      const head = /^  - (?:([a-z][a-zA-Z]*): (.*)|(.*))$/.exec(item);
      if (!head) throw bad(item);
      if (head[3] !== undefined) {
        if (maps.length) throw bad(item);
        scalars.push(scalar(head[3], path)); continue;
      }
      if (scalars.length) throw bad(item);
      const map: Record<string, string> = { [head[1]!]: scalar(head[2]!, path) };
      while (i + 1 < block.length && /^    [a-z][a-zA-Z]*: /.test(block[i + 1]!)) {
        const more = /^    ([a-z][a-zA-Z]*): (.*)$/.exec(block[++i]!)!;
        if (more[1]! in map) throw bad(block[i]!);
        map[more[1]!] = scalar(more[2]!, path);
      }
      maps.push(map);
    }
    if (!scalars.length && !maps.length) throw bad(line);
    fields.set(key!, scalars.length ? { type: 'list', items: scalars } : { type: 'maps', items: maps });
  }
  return { fields, body: lines.slice(end + 1).join('\n') };
}

/** Writes fields in the given order. Empty lists are left out; the parser never produces them either. */
export function renderFrontmatterBlock(fields: [string, string | number | string[] | Record<string, string>[] | undefined][]): string {
  const out = ['---'];
  for (const [key, value] of fields) {
    if (value === undefined || (Array.isArray(value) && !value.length)) continue;
    if (typeof value === 'number') out.push(`${key}: ${value}`);
    else if (typeof value === 'string') out.push(`${key}: ${quoteScalar(value)}`);
    else {
      out.push(`${key}:`);
      for (const item of value) {
        if (typeof item === 'string') { out.push(`  - ${quoteScalar(item)}`); continue; }
        Object.entries(item).forEach(([k, v], index) => out.push(`${index ? '    ' : '  - '}${k}: ${quoteScalar(v)}`));
      }
    }
  }
  out.push('---');
  return out.join('\n');
}
