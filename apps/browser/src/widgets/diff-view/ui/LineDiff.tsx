import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { tokenize, type TokenLine } from '@astryxdesign/core/CodeBlock';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { diffLines, diffWords, foldUnchanged, pairLines, type DiffLine, type WordPart } from '../../../shared/lib/diff';
import styles from './LineDiff.module.css';
import { t, useLanguage } from '../../../shared/i18n';

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

/** The tokenizer's language for a file, by extension; a name it does not know is read as plain text. */
export function languageOf(path: string | undefined): string {
  const extension = /\.([A-Za-z0-9]+)$/.exec(path ?? '')?.[1]?.toLowerCase() ?? '';
  return ({ ts: 'typescript', tsx: 'tsx', mts: 'typescript', cts: 'typescript', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
    json: 'json', css: 'css', html: 'html', md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash', py: 'python', sql: 'sql', toml: 'toml' } as Record<string, string>)[extension] ?? 'plaintext';
}

/** The parts of a line coloured by what they are, from the same tokenizer and colours the code blocks use. */
function Coloured({ text, tokens }: { text: string; tokens: TokenLine | undefined }) {
  if (!tokens?.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const token of tokens) {
    if (token.start > at) parts.push(text.slice(at, token.start));
    parts.push(<span key={token.start} className={styles['token-' + token.type] ?? ''}>{text.slice(token.start, token.end)}</span>);
    at = token.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</>;
}

function Content({ line, marks, tokens }: { line: DiffLine | undefined; marks: Map<DiffLine, WordPart[]>; tokens: Map<DiffLine, TokenLine> }) {
  if (!line) return null;
  const parts = marks.get(line);
  // A line whose words are marked shows the change; one that is not is coloured by its syntax.
  if (parts) return <>{parts.map((p, i) => p.changed ? <mark key={i} className={styles.word}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>)}</>;
  return <Coloured text={line.text || ' '} tokens={tokens.get(line)}/>;
}
const sign = { same: '', del: '−', add: '+' } as const;

/**
 * Two texts as source lines, the way `git diff` shows them: removed and added lines with both line numbers, the
 * changed words marked, the rest coloured by syntax, and unchanged stretches away from a change folded. The width
 * decides the layout: one column when the screen is narrow, the two sides next to each other when it is wide.
 */
export function LineDiff({ before, after, label, language = 'plaintext' }: { before: string | null; after: string | null; label: string; language?: string }) {
  useLanguage();
  // Two versions side by side need the room; below that width they would each be too narrow to read.
  const view = useMediaQuery('(min-width: 1024px)') ? 'split' : 'unified';
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const marks = useMemo(() => wordMarks(lines), [lines]);
  // Both sides are tokenized whole, so a string or comment that runs over several lines is coloured as one thing.
  const tokens = useMemo(() => {
    const map = new Map<DiffLine, TokenLine>();
    for (const [text, side] of [[before, 'del'], [after, 'add']] as const) {
      if (text === null) continue;
      const rows = tokenize(text.replace(/\r\n/g, '\n').replace(/\n$/, ''), language);
      let row = 0;
      for (const line of lines) { if (line.type === 'same' || line.type === side) { const found = rows[row++]; if (found) map.set(line, found); } }
    }
    return map;
  }, [before, after, language, lines]);
  const blocks = useMemo(() => foldUnchanged(lines), [lines]);
  if (!lines.some(l => l.type !== 'same')) return <Text type="supporting" color="secondary">{t('diff.bodyUnchanged')}</Text>;
  return <VStack gap={0} className={styles.frame}>
    <table className={`${styles.diff} ${view === 'split' ? styles.split : ''}`} aria-label={label}>
      {/* Widths come from the columns: the first row may be a fold spanning them all, which a fixed layout would size from. */}
      <colgroup>{(view === 'split' ? ['number', 'code', 'number', 'code'] : ['number', 'number', 'sign', 'code']).map((c, i) =>
        <col key={i} className={c === 'number' ? styles.numberColumn : c === 'sign' ? styles.signColumn : undefined}/>)}</colgroup>
      <tbody>
        {blocks.map((block, index) => block.kind === 'fold' && !opened.has(index)
          ? <tr key={index} className={styles.foldRow}><td colSpan={4}>
            <Button variant="ghost" size="sm" label={t('diff.unfold', { count: block.lines.length })} onClick={() => setOpened(new Set(opened).add(index))}/>
          </td></tr>
          : view === 'split'
            ? pairLines(block.lines).map(([left, right], i) => <tr key={index + ':' + i}>
              <td className={`${styles.number} ${left ? styles[left.type] : styles.empty}`}>{left?.old ?? ''}</td>
              <td className={`${styles.code} ${left ? styles[left.type] : styles.empty}`}><Content line={left} marks={marks} tokens={tokens}/></td>
              <td className={`${styles.number} ${styles.numberRight} ${right ? styles[right.type] : styles.empty}`}>{right?.new ?? ''}</td>
              <td className={`${styles.code} ${right ? styles[right.type] : styles.empty}`}><Content line={right} marks={marks} tokens={tokens}/></td>
            </tr>)
            : block.lines.map((line, i) => <tr key={index + ':' + i} className={styles[line.type]}>
              <td className={styles.number}>{line.old ?? ''}</td>
              <td className={`${styles.number} ${styles.numberRight}`}>{line.new ?? ''}</td>
              <td className={styles.sign} aria-hidden>{sign[line.type]}</td>
              <td className={styles.code}><Content line={line} marks={marks} tokens={tokens}/></td>
            </tr>))}
      </tbody>
    </table>
  </VStack>;
}
