import { parseOutlineFromMarkdown } from '@astryxdesign/core/Outline';

const REFERENCE = /^<!-- gitifact-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/;
const plain = (value: string) => value.replace(/[*_`]/g, '').trim();

/**
 * Which design section explains a requirement, as the id Markdown renders on that section's heading.
 *
 * A design marks a section by putting a ref comment under its heading, so the heading above a ref owns the
 * requirements it names. The ids come from the outline of the same text, which is how Markdown builds the ids it
 * renders, so a link carrying one as its fragment lands on that heading. Headings are matched to the outline by
 * their order in the document, and a pair whose text disagrees is dropped rather than guessed at: a link to the
 * wrong section is worse than no link. 38 of this repository's 39 requirements are named by a section.
 */
export function designSectionsOf(body: string): Map<string, string> {
  const outline = parseOutlineFromMarkdown(body);
  const sections = new Map<string, string>();
  let fence: { char: string; size: number } | undefined;
  let index = -1;
  let id: string | undefined;
  for (const line of body.split('\n')) {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; continue; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = { char: open[1]![0]!, size: open[1]!.length }; continue; }
    const heading = /^#{1,6} +(.+?)\s*$/.exec(line);
    if (heading) {
      index += 1;
      const item = outline[index];
      id = item && plain(item.label) === plain(heading[1]!) ? item.id : undefined;
      continue;
    }
    const reference = REFERENCE.exec(line);
    if (reference && id) for (const requirement of reference[1]!.split(', ')) if (!sections.has(requirement)) sections.set(requirement, id);
  }
  return sections;
}
