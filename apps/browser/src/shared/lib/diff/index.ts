/**
 * Line and word differences between two texts, the way `git diff` reads them: the longest common subsequence decides
 * what stayed, the rest is removed from the old text or added to the new one. Documents are a few hundred lines, so
 * the plain dynamic programming table is small enough; texts beyond the limit are compared as a whole replacement.
 */
export type DiffLine = { type: 'same' | 'del' | 'add'; text: string; old?: number; new?: number };
export type DiffBlock = { kind: 'lines'; lines: DiffLine[] } | { kind: 'fold'; lines: DiffLine[] };
export type WordPart = { text: string; changed: boolean };

/** Cells of the comparison table above which two texts are shown as removed-then-added instead. */
const LIMIT = 4_000_000;

function common<T>(a: readonly T[], b: readonly T[]): ('same' | 'del' | 'add')[] {
  const n = a.length, m = b.length;
  if (n * m > LIMIT) return [...a.map(() => 'del' as const), ...b.map(() => 'add' as const)];
  // lengths[i][j]: the longest common run of a[i..] and b[j..], filled from the end.
  const width = m + 1; const lengths = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    lengths[i * width + j] = a[i] === b[j] ? lengths[(i + 1) * width + j + 1]! + 1 : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
  const out: ('same' | 'del' | 'add')[] = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push('same'); i++; j++; }
    // Removals first, as git prints them, when both ways keep the same common run.
    else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) { out.push('del'); i++; }
    else { out.push('add'); j++; }
  }
  while (i++ < n) out.push('del'); while (j++ < m) out.push('add');
  return out;
}

/** Every line of both texts in reading order, numbered on the side it belongs to. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n'); const b = after.replace(/\r\n/g, '\n').split('\n');
  const out: DiffLine[] = []; let i = 0, j = 0;
  for (const step of common(a, b)) {
    if (step === 'same') { out.push({ type: 'same', text: a[i]!, old: i + 1, new: j + 1 }); i++; j++; }
    else if (step === 'del') { out.push({ type: 'del', text: a[i]!, old: i + 1 }); i++; }
    else { out.push({ type: 'add', text: b[j]!, new: j + 1 }); j++; }
  }
  return out;
}

/** Unchanged runs longer than twice the context fold, keeping `context` lines next to each change. */
export function foldUnchanged(lines: readonly DiffLine[], context = 3): DiffBlock[] {
  const blocks: DiffBlock[] = []; let start = 0;
  const push = (kind: DiffBlock['kind'], part: DiffLine[]) => {
    if (!part.length) return;
    const last = blocks[blocks.length - 1];
    if (kind === 'lines' && last?.kind === 'lines') last.lines.push(...part); else blocks.push({ kind, lines: part });
  };
  while (start < lines.length) {
    let end = start; const same = lines[start]!.type === 'same';
    while (end < lines.length && (lines[end]!.type === 'same') === same) end++;
    const run = lines.slice(start, end);
    if (!same) push('lines', run);
    else {
      // The first run has no change before it and the last none after, so they keep context on one side only.
      const head = start === 0 ? 0 : context; const tail = end === lines.length ? 0 : context;
      if (run.length > head + tail + 1) { push('lines', run.slice(0, head)); push('fold', run.slice(head, run.length - tail)); push('lines', run.slice(run.length - tail)); }
      else push('lines', run);
    }
    start = end;
  }
  return blocks;
}

/** Words and the spaces between them, so a changed word is marked without its neighbours. */
const tokens = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];

/** The parts of a removed and an added line that differ, for marking inside a changed line. */
export function diffWords(before: string, after: string): { before: WordPart[]; after: WordPart[] } {
  const a = tokens(before); const b = tokens(after);
  const out = { before: [] as WordPart[], after: [] as WordPart[] }; let i = 0, j = 0;
  const add = (side: WordPart[], text: string, changed: boolean) => {
    const last = side[side.length - 1];
    if (last && last.changed === changed) last.text += text; else side.push({ text, changed });
  };
  for (const step of common(a, b)) {
    if (step === 'same') { add(out.before, a[i]!, false); add(out.after, b[j]!, false); i++; j++; }
    else if (step === 'del') add(out.before, a[i++]!, true);
    else add(out.after, b[j++]!, true);
  }
  return out;
}

/**
 * Removed and added lines side by side: within each change the n-th removed line faces the n-th added one, and
 * unchanged lines face themselves. Unpaired lines face an empty cell.
 */
export function pairLines(lines: readonly DiffLine[]): [DiffLine | undefined, DiffLine | undefined][] {
  const rows: [DiffLine | undefined, DiffLine | undefined][] = []; let k = 0;
  while (k < lines.length) {
    if (lines[k]!.type === 'same') { rows.push([lines[k], lines[k]]); k++; continue; }
    const dels: DiffLine[] = []; const adds: DiffLine[] = [];
    while (k < lines.length && lines[k]!.type !== 'same') (lines[k]!.type === 'del' ? dels : adds).push(lines[k++]!);
    for (let n = 0; n < Math.max(dels.length, adds.length); n++) rows.push([dels[n], adds[n]]);
  }
  return rows;
}
