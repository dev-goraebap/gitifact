import { Fragment, useState } from 'react';
import type { DesignSource, SpecFeature, SpecSnapshot } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { diffLines, diffWords, foldUnchanged, pairLines, type DiffLine, type WordPart } from '../../../shared/lib/diff';
import { useDocumentIndex } from '../../../shared/ui/document';
import styles from './ChangeDiff.module.css';
import { t, useLanguage } from '../../../shared/i18n';

type Mode = 'unified' | 'split';
const STORAGE = 'gitifact-diff-view';
// The layout is a reader's habit, like the drawer width, so it is remembered in this browser only.
const storedMode = (): Mode => { try { return localStorage.getItem(STORAGE) === 'split' ? 'split' : 'unified'; } catch { return 'unified'; } };

/**
 * One frontmatter field that changed, read as a value rather than as lines: a single value as "before → after", a
 * list as the entries it lost and gained, since repeating the whole list twice hides what moved.
 */
type Field = { name: string; before: string[]; after: string[]; list: boolean };
const sourceKey = (s: DesignSource) => s.id ?? s.url ?? s.title ?? '';

function fieldChanges(before: SpecSnapshot, after: SpecSnapshot, title: (id: string) => string): Field[] {
  const sourceName = (s: DesignSource) => s.title ?? (s.id ? title(s.id) : s.url) ?? '';
  const fields: Field[] = [];
  const value = (name: string, a: string, b: string) => { if (a !== b) fields.push({ name, before: [a || '—'], after: [b || '—'], list: false }); };
  const list = <T,>(name: string, a: T[], b: T[], key: (item: T) => string, label: (item: T) => string) => {
    const had = new Set(a.map(key)); const has = new Set(b.map(key));
    const lost = a.filter(item => !has.has(key(item))).map(label); const gained = b.filter(item => !had.has(key(item))).map(label);
    if (lost.length || gained.length) fields.push({ name, before: lost, after: gained, list: true });
  };
  value('title', before.title, after.title);
  value('description', before.description, after.description);
  value('order', before.order?.toString() ?? '', after.order?.toString() ?? '');
  list('requirements', before.requirements ?? [], after.requirements ?? [], id => id, title);
  list('sources', before.sources ?? [], after.sources ?? [], sourceKey, sourceName);
  value('path', before.path, after.path);
  return fields;
}

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
 * A change read the way `git diff` shows it: the frontmatter fields that changed as "before → after", then the body
 * as source lines, removed and added, with long unchanged stretches folded and the changed words marked. Unified is
 * the default; a wide screen may lay the two sides next to each other.
 */
export function ChangeDiff({ before, after, features }: { before: SpecSnapshot; after: SpecSnapshot; features: SpecFeature[] }) {
  useLanguage();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [chosen, setChosen] = useState<Mode>(storedMode);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const mode: Mode = wide ? chosen : 'unified';
  const choose = (next: Mode) => { setChosen(next); try { localStorage.setItem(STORAGE, next); } catch { /* kept for this page only */ } };
  const index = useDocumentIndex();
  // A requirement or a page named by ID reads by its current title; one that no longer exists keeps its ID.
  const title = (id: string) => features.flatMap(f => f.requirements).find(r => r.id === id)?.title ?? index.documents.find(d => d.id === id)?.title ?? id;
  const fields = fieldChanges(before, after, title);
  const lines = diffLines(before.body, after.body);
  const marks = wordMarks(lines);
  const blocks = foldUnchanged(lines);
  const changed = lines.some(l => l.type !== 'same');
  return <VStack gap={4}>
    {!!fields.length && <VStack as="section" gap={2} aria-label={t('diff.fields')} className={styles.fields}>
      {fields.map(f => <HStack key={f.name} gap={2} wrap="wrap" className={styles.field}>
        <Text type="supporting" color="secondary" className={styles.fieldName}>{f.name}</Text>
        {f.list
          ? <>{f.before.map(item => <del key={'-' + item} className={styles.fieldBefore}>{item}</del>)}{f.after.map(item => <ins key={'+' + item} className={styles.fieldAfter}>{item}</ins>)}</>
          : <><del className={styles.fieldBefore}>{f.before[0]}</del><Text type="supporting" color="secondary">→</Text><ins className={styles.fieldAfter}>{f.after[0]}</ins></>}
      </HStack>)}
    </VStack>}
    {changed ? <VStack gap={2}>
      {wide && <HStack gap={0} className={styles.toolbar}>
        <SegmentedControl label={t('diff.layout')} value={mode} onChange={(value: string) => choose(value === 'split' ? 'split' : 'unified')} size="sm">
          <SegmentedControlItem value="unified" label={t('diff.unified')}/>
          <SegmentedControlItem value="split" label={t('diff.split')}/>
        </SegmentedControl>
      </HStack>}
      <table className={`${styles.diff} ${mode === 'split' ? styles.split : ''}`} aria-label={t('diff.body')}>
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
    </VStack> : <Text type="supporting" color="secondary">{t('diff.bodyUnchanged')}</Text>}
  </VStack>;
}
