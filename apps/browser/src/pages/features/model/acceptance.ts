// The acceptance section heading in either language the guides write: `### 수용 조건` or `### Acceptance criteria`.
const heading = /^###\s+(?:수용 조건|acceptance criteria)\s*$/i;

/**
 * How many acceptance criteria a requirement body lists: the numbered items under its acceptance heading, up to the
 * next heading. A body without that heading has no count; the list says nothing rather than zero.
 */
export function acceptanceCount(body: string): number | undefined {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => heading.test(line.trim()));
  if (start < 0) return undefined;
  let count = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (/^\d+\.\s/.test(line)) count++;
  }
  return count || undefined;
}
