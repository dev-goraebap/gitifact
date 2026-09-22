import type { SpecDesign } from '@gitifact/contracts';

/**
 * Which design documents explain a requirement: every one that names it in its frontmatter `requirements`, in
 * `order`. The values are design IDs, which are also what the design tab selects, so a link carrying one opens that
 * document. The body is never read for this.
 */
export function designsByRequirement(designs: SpecDesign[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  for (const design of designs) for (const requirement of design.requirements) sections.set(requirement, [...(sections.get(requirement) ?? []), design.id]);
  return sections;
}
