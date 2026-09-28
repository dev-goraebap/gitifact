/**
 * A requirement's list items put each part of an item on its own line — `조건:` then `기대 동작:`, and `경로:` first in a
 * use case — but Markdown joins the lines of one item into one paragraph, so they read as a single run-on line. This
 * ends each such line with a hard break before the item goes on, for drawing only; the file is never changed.
 * A line goes on when the next one is indented under the item and is not a list item of its own. Code fences are left
 * alone.
 */
export function withItemLineBreaks(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let fenced = false;
  return lines.map((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; }
    const next = lines[index + 1];
    if (fenced || next === undefined || !line.trim() || / {2}$/.test(line)) return line;
    const inItem = /^\s*(\d+\.|[-*])\s/.test(line) || /^\s{2,}\S/.test(line);
    const goesOn = /^\s{2,}\S/.test(next) && !/^\s*(\d+\.|[-*])\s/.test(next);
    return inItem && goesOn ? line + '  ' : line;
  }).join('\n');
}
