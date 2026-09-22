import type { DesignSource, SpecFeature, SpecSnapshot } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { useDocumentIndex } from '../../../shared/ui/document';
import { LineDiff } from '../../../widgets/diff-view';
import styles from './ChangeDiff.module.css';
import { t, useLanguage } from '../../../shared/i18n';

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

/**
 * A document change read the way `git diff` shows it: the frontmatter fields that changed as "before → after", then
 * the body as source lines (`LineDiff`).
 */
export function ChangeDiff({ before, after, features }: { before: SpecSnapshot; after: SpecSnapshot; features: SpecFeature[] }) {
  useLanguage();
  const index = useDocumentIndex();
  // A requirement or a page named by ID reads by its current title; one that no longer exists keeps its ID.
  const title = (id: string) => features.flatMap(f => f.requirements).find(r => r.id === id)?.title ?? index.documents.find(d => d.id === id)?.title ?? id;
  const fields = fieldChanges(before, after, title);
  return <VStack gap={4}>
    {!!fields.length && <VStack as="section" gap={2} aria-label={t('diff.fields')} className={styles.fields}>
      {fields.map(f => <HStack key={f.name} gap={2} wrap="wrap" className={styles.field}>
        <Text type="supporting" color="secondary" className={styles.fieldName}>{f.name}</Text>
        {f.list
          ? <>{f.before.map(item => <del key={'-' + item} className={styles.fieldBefore}>{item}</del>)}{f.after.map(item => <ins key={'+' + item} className={styles.fieldAfter}>{item}</ins>)}</>
          : <><del className={styles.fieldBefore}>{f.before[0]}</del><Text type="supporting" color="secondary">→</Text><ins className={styles.fieldAfter}>{f.after[0]}</ins></>}
      </HStack>)}
    </VStack>}
    <LineDiff before={before.body} after={after.body} label={t('diff.body')}/>
  </VStack>;
}
