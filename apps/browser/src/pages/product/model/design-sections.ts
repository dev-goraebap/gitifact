import type { SpecDesign } from '@gitifact/contracts';

/**
 * Which design document explains a requirement: the first one, in `order`, that names it in its frontmatter
 * `requirements`. The value is the design's ID, which is also the id of its section on the design tab, so a link
 * carrying it as the fragment lands on that document. The body is never read for this.
 */
export function designsByRequirement(designs: SpecDesign[]): Map<string, string> {
  const sections = new Map<string, string>();
  for (const design of designs) for (const requirement of design.requirements) if (!sections.has(requirement)) sections.set(requirement, design.id);
  return sections;
}
