import { recordPathPattern, SpecPreviewError } from '@gitifact/core';
import { t } from '../../shared/i18n/index.js';

/** Records touched by a remerge patch, rather than by the changes brought in from another branch.
 * Full-file context is requested by the caller so a changed line can be assigned to its record even when its
 * heading is far away. Read both sides: a deleted requirement has no marker on the new side. Conflict markers
 * need not be interpreted; they are just changed lines inside the surrounding requirement.
 */
export function remergeRecords(patch: string): Set<string> {
  const touched = new Set<string>();
  for (const file of patch.split(/^diff --git /m).slice(1)) {
    const lines = file.split('\n');
    const oldPath = lines.find(l => l.startsWith('--- '))?.slice(4);
    const newPath = lines.find(l => l.startsWith('+++ '))?.slice(4);
    if (!oldPath && !newPath) continue; // A mode-only change has no document change.
    const path = (newPath === '/dev/null' ? oldPath : newPath)?.replace(/^[ab]\//, '');
    if (!path || !recordPathPattern.test(path) || !path.endsWith('.md')) continue;
    const start = lines.findIndex(l => l.startsWith('@@ '));
    if (start < 0 || !/^@@ -[01](?:,\d+)? \+[01](?:,\d+)? @@/.test(lines[start]!)) throw new SpecPreviewError(t('specReader.historyUnreadable'));
    for (const side of ['-', '+']) {
      const content: { text: string; changed: boolean }[] = [];
      for (const line of lines.slice(start + 1)) {
        if (line.startsWith('@@ ')) throw new SpecPreviewError(t('specReader.historyUnreadable'));
        if (line.startsWith(' ') || line.startsWith(side)) content.push({ text: line.slice(1).replace(/\r$/, ''), changed: line.startsWith(side) });
      }
      if (!path.endsWith('/requirements.md')) {
        const source = content.map(l => l.text).join('\n');
        const id = /^(?:id: "?|<!-- gitifact-(?:design|product|guide): )([SWPG]-[a-z2-7]{10})(?:"?$| -->$)/m.exec(source)?.[1];
        if (id && content.some(l => l.changed)) touched.add(id);
        continue;
      }
      // Match the specification parser's ATX sections and fenced examples. Headings precede their ID comments.
      let section: typeof content = []; let fence: { char: string; size: number } | undefined;
      const finish = () => {
        if (!section[0]?.text.startsWith('## ')) return;
        const id = section.map(l => /^<!-- gitifact-req: (R-[a-z2-7]{10}) -->$/.exec(l.text)?.[1]).find(Boolean);
        if (id && section.some(l => l.changed)) touched.add(id);
      };
      for (const line of content) {
        if (!fence && /^## /.test(line.text)) { finish(); section = []; }
        section.push(line);
        if (fence) {
          if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line.text)) fence = undefined;
        } else {
          const match = /^ {0,3}(`{3,}|~{3,})/.exec(line.text);
          if (match) fence = { char: match[1]![0]!, size: match[1]!.length };
        }
      }
      finish();
    }
  }
  return touched;
}
