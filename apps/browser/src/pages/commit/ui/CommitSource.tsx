import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, CommitFile } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { commitFileOptions, commitFilesOptions } from '../../../entities/project';
import { LineDiff, languageOf } from '../../../widgets/diff-view';
import styles from './commit.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const colors = { added: 'green', modified: 'blue', deleted: 'red', renamed: 'purple' } as const;
const names = () => ({ added: t('source.added'), modified: t('source.modified'), deleted: t('source.deleted'), renamed: t('source.renamed') });
const lines = () => [92, 86, 74].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>);

/** One file's two sides, read only once the reader opens its row. */
function FileDiff({ session, commit, file }: { session: BrowserSessionV3; commit: string; file: CommitFile }) {
  useLanguage();
  const query = useQuery(commitFileOptions(session, commit, file.path));
  if (query.error) return <Text type="supporting" color="secondary" role="alert">{t('source.fileFailed')}</Text>;
  if (!query.data) return <VStack gap={2} role="status" aria-label={t('source.fileLoading')}>{lines()}</VStack>;
  if (query.data.binary) return <Text type="supporting" color="secondary">{t('source.binary')}</Text>;
  if (query.data.tooLarge) return <Text type="supporting" color="secondary">{t('source.tooLarge')}</Text>;
  return <LineDiff before={query.data.before} after={query.data.after} label={t('source.fileDiff', { path: file.path })} language={languageOf(file.path)}/>;
}

/**
 * The source files the same commit changed beside the document: each row names a file with how it changed and how
 * many lines, and opens to that file's diff. Documents are left out, being the change shown above.
 */
export function CommitSource({ session, commit }: { session: BrowserSessionV3; commit: string }) {
  useLanguage();
  const query = useQuery(commitFilesOptions(session, commit));
  const [open, setOpen] = useState<string[]>([]);
  const data = query.data;
  return <VStack as="section" gap={3} aria-label={t('source.title')} className={styles.readingSection}>
    <Heading level={3}>{t('source.title')}</Heading>
    {query.error ? <Text type="supporting" color="secondary" role="alert">{t('source.listFailed')}</Text>
      : !data ? <VStack gap={2} role="status" aria-label={t('source.listLoading')}>{lines()}</VStack>
      : !data.files.length ? <Text type="supporting" color="secondary">{t('source.none')}</Text>
      : <>
        <Text type="supporting" color="secondary">{t('source.count', { count: data.total })}{data.total > data.files.length ? ' · ' + t('source.shown', { count: data.files.length }) : ''}</Text>
        <CollapsibleGroup type="multiple" hasDividers density="compact" value={open} onChange={value => setOpen(Array.isArray(value) ? value : [value])}>
          {data.files.map(file => <Collapsible key={file.path} value={file.path} trigger={<HStack gap={2} className={styles.sourceRow}>
            <Token label={names()[file.status]} color={colors[file.status]} size="sm"/>
            <Text className={styles.sourcePath}>{file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}</Text>
            {file.additions !== null && <Text type="supporting" className={styles.sourceAdded}>+{file.additions}</Text>}
            {file.deletions !== null && <Text type="supporting" className={styles.sourceRemoved}>−{file.deletions}</Text>}
          </HStack>}>
            {/* Closed rows read nothing: a commit may change hundreds of files and the reader opens a few. */}
            {open.includes(file.path) && <FileDiff session={session} commit={commit} file={file}/>}
          </Collapsible>)}
        </CollapsibleGroup>
      </>}
  </VStack>;
}
