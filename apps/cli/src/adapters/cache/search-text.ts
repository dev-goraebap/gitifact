/**
 * Plain text of a Markdown body, so a match is judged and shown on what the reader sees rather than on syntax.
 * Markers are only removed where they mark: at the start of a line, or around a link. Stripping every hyphen and
 * pipe wherever it appeared turned dates into "2026 09 18".
 */
export function plain(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*[#>]+\s*/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\|/gm, ' ').replace(/\|/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/**
 * One line of the text around the first match. The search box is for finding a record, so the line is evidence
 * that the word is really in there — not a preview of the record.
 */
export function snippet(text: string, query: string) {
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return text.slice(0, 90);
  const from = Math.max(0, at - 30);
  return (from > 0 ? '…' : '') + text.slice(from, at + query.length + 70).trim() + (at + query.length + 70 < text.length ? '…' : '');
}

/** A LIKE pattern that matches the text anywhere, with the pattern characters in it taken literally. */
export const containing = (query: string) => '%' + query.replace(/[\\%_]/g, c => '\\' + c) + '%';
