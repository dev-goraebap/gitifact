/** The Astryx colours an instruction can take, red left out because it means an error. Each follows light and dark mode. */
export const instructionColors = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'cyan', 'yellow'] as const;
export type InstructionColor = typeof instructionColors[number];

// FNV-1a: small, stable, and spreads IDs that differ in one character.
function hash(id: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { value ^= id.charCodeAt(i); value = Math.imul(value, 0x01000193); }
  return value >>> 0;
}

/**
 * A colour for every instruction of the project, apart from one another. In name order each instruction starts at the colour its
 * ID hashes to and moves on to the next colour its neighbours have not taken, so up to eight instructions never share one.
 * The same instructions always get the same colours on every screen; adding or removing an instruction may move another's.
 */
export function instructionColorsOf(instructions: readonly { id: string; name: string }[]): Map<string, InstructionColor> {
  const colors = new Map<string, InstructionColor>(); const taken = new Set<InstructionColor>();
  for (const instruction of [...instructions].sort((a, b) => a.name.localeCompare(b.name))) {
    const start = hash(instruction.id) % instructionColors.length;
    // Past eight instructions every colour is taken, and the hash alone decides.
    if (taken.size === instructionColors.length) taken.clear();
    let at = start;
    while (taken.has(instructionColors[at]!)) at = (at + 1) % instructionColors.length;
    colors.set(instruction.id, instructionColors[at]!); taken.add(instructionColors[at]!);
  }
  return colors;
}
