import { Fragment, useState } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { diffLines, diffWords, foldUnchanged, pairLines, type DiffLine, type WordPart } from '../../../shared/lib/diff';
import styles from './LineDiff.module.css';
import { t, useLanguage } from '../../../shared/i18n';

type Mode = 'unified' | 'split';
const STORAGE = 'gitifact-diff-view';
// The layout is a reader's habit, like the drawer width, so it is remembered in this browser only.
const storedMode = (): Mode => { try { return localStorage.getItem(STORAGE) === 'split' ? 'split' : 'unified'; } catch { return 'unified'; } };

/** Word marks for the lines of one change: the n-th removed line against the n-th added one, when they are alike. */
function wordMarks(lines: readonly DiffLine[]): Map<DiffLine, WordPart[]> {
  const marks = new Map<DiffLine, WordPart[]>();
  for (const [del, add] of pairLines(lines)) {
    if (!del || !add || del === add) continue;
    const words = diffWords(del.text, add.text);
    // Lines with little in common (under a quarter kept) are shown as replaced whole; marking nearly every word says nothing.
    const kept = words.after.filter(p => !p.changed).reduce((n, p) => n + p.text.trim().length, 0);
    if (kept * 4 < Math.max(del.text.trim().length, add.text.trim().length)) continue;
    marks.set(del, words.before); marks.set(add, words.after);
  }
  return marks;
}

function Content({ line, marks }: { line: DiffLine | undefined; marks: Map<DiffLine, WordPart[]> }) {
  if (!line) return null;
  const parts = marks.get(line);
  return <>{parts ? parts.map((p, i) => p.changed ? <mark key={i} className={styles.word}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>) : line.text || ' '}</>;
}
const sign = { same: ' ', del: '-', add: '+' } as const;

/**
 * Two texts as source lines, the way `git diff` shows them: removed and added lines with both line numbers, the
 * changed words marked, and unchanged stretches away from a change folded. Unified is the default; a wide screen may
 * lay the two sides next to each other. A null side did not exist, so every line of the other is added or removed.
 */
export function LineDiff({ before, after, label }: { before: string | null; after: string | null; label: string }) {
  useLanguage();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [chosen, setChosen] = useState<Mode>(storedMode);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const mode: Mode = wide ? chosen : 'unified';
  const choose = (next: Mode) => { setChosen(next); try { localStorage.setItem(STORAGE, next); } catch { /* kept for this page only */ } };
  const lines = diffLines(before, after);
  const marks = wordMarks(lines);
  const blocks = foldUnchanged(lines);
  if (!lines.some(l => l.type !== 'same')) return <Text type="supporting" color="secondary">{t('diff.bodyUnchanged')}</Text>;
  return <VStack gap={2}>
      {wide && <HStack gap={0} className={styles.toolbar}>
        <SegmentedControl label={t('diff.layout')} value={mode} onChange={(value: string) => choose(value === 'split' ? 'split' : 'unified')} size="sm">
          <SegmentedControlItem value="unified" label={t('diff.unified')}/>
          <SegmentedControlItem value="split" label={t('diff.split')}/>
        </SegmentedControl>
      </HStack>}
      <table className={`${styles.diff} ${mode === 'split' ? styles.split : ''}`} aria-label={label}>
        {/* Widths come from the columns: the first row may be a fold spanning them all, which a fixed layout would size from. */}
        <colgroup>{(mode === 'split' ? ['number', 'code', 'number', 'code'] : ['number', 'number', 'code']).map((c, i) => <col key={i} className={c === 'number' ? styles.numberColumn : undefined}/>)}</colgroup>
        <tbody>
          {blocks.map((block, index) => block.kind === 'fold' && !opened.has(index)
            ? <tr key={index} className={styles.foldRow}><td colSpan={mode === 'split' ? 4 : 3}>
              <Button variant="ghost" size="sm" label={t('diff.unfold', { count: block.lines.length })} onClick={() => setOpened(new Set(opened).add(index))}/>
            </td></tr>
            : mode === 'split'
              ? pairLines(block.lines).map(([left, right], i) => <tr key={index + ':' + i}>
                <td className={styles.number}>{left?.old ?? ''}</td>
                <td className={`${styles.code} ${left ? styles[left.type] : styles.empty}`}><Content line={left} marks={marks}/></td>
                <td className={styles.number}>{right?.new ?? ''}</td>
                <td className={`${styles.code} ${right ? styles[right.type] : styles.empty}`}><Content line={right} marks={marks}/></td>
              </tr>)
              : block.lines.map((line, i) => <tr key={index + ':' + i} className={styles[line.type]}>
                <td className={styles.number}>{line.old ?? ''}</td>
                <td className={styles.number}>{line.new ?? ''}</td>
                <td className={styles.code}><span className={styles.sign} aria-hidden>{sign[line.type]}</span><Content line={line} marks={marks}/></td>
              </tr>))}
        </tbody>
      </table>
  </VStack>;
}
