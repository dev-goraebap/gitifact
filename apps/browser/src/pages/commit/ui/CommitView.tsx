import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { commitOptions } from '../../../entities/project';
import { KindToken } from '../../../entities/document';
import { groupRecords } from '../../../widgets/activity-timeline';
import { ChangeSection } from './ChangeSection';
import { CommitHeading } from './CommitHeading';
import { CommitSkeleton } from './CommitSkeleton';
import { CommitSource } from './CommitSource';
import styles from './commit.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One commit, read as it was made: who wrote it, the records it added as a list of titles — each record is read on its
 * own page — then each document it changed with its differences, then the source beside them. A change is a section
 * of this page, so the reader compares at the width of the screen and keeps one address for the whole commit; a link
 * that names a document opens the page at that section.
 */
export function CommitView({ commit, documentId, session, features, head }: { commit: string; documentId?: string | undefined; session: BrowserSessionV3; features: SpecFeature[]; head: string | null }) {
  useLanguage();
  const query = useQuery(commitOptions(session, commit));
  const data = query.data;
  // An address typed or shared from outside names its section before the page has drawn it, so the page lands on it.
  useEffect(() => { if (data && documentId) document.getElementById(documentId)?.scrollIntoView({ block: 'start' }); }, [data, documentId]);
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <CommitSkeleton label={t('commit.loading')}/>;
  const groups = groupRecords(data.changes.map(c => c.event));
  const recorded = groups.filter(group => group.record);
  const bare = groups.find(group => !group.record && group.missing);
  return <VStack gap={0} as="article" aria-label={t('commit.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <CommitHeading title={data.message} commit={data}/>

    <VStack as="section" gap={3} aria-label={t('event.records')} className={styles.commitSection}>
      <Heading level={2}>{t('event.records')}</Heading>
      {recorded.length ? <VStack as="ul" gap={0} className={styles.recordList}>
        {recorded.map(group => <HStack as="li" key={group.key} gap={3} className={styles.recordItem}>
          <Link to="/records/$recordId" params={{ recordId: group.record!.id }} className={styles.recordLink}>{group.record!.title}</Link>
          <Text type="supporting" color="secondary" className={styles.recordItemMeta}>{t('activity.recordCount', { count: group.events.length })}</Text>
        </HStack>)}
      </VStack> : <Text color="secondary">{t('event.noRecords')}</Text>}
      {bare && <VStack gap={2}>
        <Text color="secondary">{t('event.noRecord')}</Text>
        <HStack gap={2} wrap="wrap" className={styles.reasonRecords}>
          {bare.events.map(e => <a key={e.key} href={`#${e.id}`} className={styles.reasonRecord}>
            <KindToken kind={e.kind}/>{(e.after ?? e.before)?.title ?? e.id}
          </a>)}
        </HStack>
      </VStack>}
    </VStack>

    {!!data.changes.length && <VStack as="section" gap={0} aria-label={t('commit.documents')} className={styles.commitSection}>
      <Heading level={2}>{t('commit.documents')}</Heading>
      {data.changes.map(change => <ChangeSection key={change.event.key} change={change} features={features} head={head} current={change.event.id === documentId}/>)}
    </VStack>}
    {!data.changes.length && <PageState isCompact title={t('commit.noDocuments')} description={t('commit.noDocumentsDescription')}/>}

    <CommitSource session={session} commit={commit}/>
  </VStack>;
}
