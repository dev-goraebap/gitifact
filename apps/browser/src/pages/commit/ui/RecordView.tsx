import { useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { commitOptions, recordOptions } from '../../../entities/project';
import { groupRecords } from '../../../widgets/activity-timeline';
import { RecordDocuments } from './RecordDocuments';
import { commitChange, listed, loadedCommit } from '../model/commit-changes';
import { CommitHeading } from './CommitHeading';
import { CommitSkeleton } from './CommitSkeleton';
import { RecordCommit } from './RecordCommit';
import { RecordSections } from './RecordSections';
import { WorkingRecord } from './WorkingRecord';
import { ApiError } from '../../../shared/api/client';
import styles from './commit.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One record as its own page: its title and sections, each document it explains with its differences, and a card for
 * the commit that added it. The commit's other records and its source code belong to the commit, so the card links to
 * them on the commit page. The record is found through the history of the HEAD the reader is on, then read from its
 * commit. A record names the documents it explains among its commit's changes, so the page reads them all at once
 * (up to 500) rather than twenty at a time; their text is read when one is opened.
 */
/** The most changes the API gives in one page: enough for every document of one commit. */
const ALL = 500;

export function RecordView({ recordId, documentId, session, features, head }: { recordId: string; documentId?: string | undefined; session: BrowserSessionV3; features: SpecFeature[]; head: string }) {
  useLanguage();
  const found = useQuery(recordOptions(session, head, recordId));
  const commit = found.data?.commit;
  const query = useInfiniteQuery({ ...commitOptions(session, commit ?? '', ALL), enabled: !!commit });
  const data = loadedCommit(query);
  useEffect(() => { if (data && documentId) document.getElementById(documentId)?.scrollIntoView({ block: 'start' }); }, [data, documentId]);
  // A record HEAD's history does not have may be one not committed yet, which the uncommitted work names.
  if (found.error instanceof ApiError && found.error.code === 'NOT_FOUND') return <WorkingRecord recordId={recordId} documentId={documentId} session={session} features={features} head={head}/>;
  const error = found.error ?? query.error;
  if (error) return <RequestState error={error} retry={() => { void (found.error ? found.refetch() : query.refetch()); }}/>;
  if (!data || !commit) return <CommitSkeleton label={t('record.loading')}/>;
  const groups = groupRecords(data.changes);
  const group = groups.find(g => g.ids.includes(recordId));
  if (!group?.record) return <PageState isCompact title={t('record.missing')}/>;
  const record = group.record;
  const explained = data.changes.filter(c => group.events.includes(c)).map(listed);
  const others = groups.filter(g => g.record && g !== group);
  return <VStack gap={0} as="article" aria-label={t('record.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <CommitHeading title={record.title} commit={data}
      hash={<Link to="/records/commits/$commit" params={{ commit }} className={styles.commitHashLink}>{commit.slice(0, 12)}</Link>}>
      <HStack gap={2} className={styles.recordCommit}>
        <Text type="supporting" color="secondary">{record.id}</Text>
        <Text type="supporting" color="secondary" aria-hidden>·</Text>
        <Link to="/records/commits/$commit" params={{ commit }} className={styles.recordCommitMessage}>{data.message}</Link>
      </HStack>
      <RecordCommit session={session} commit={commit} others={others.length}/>
    </CommitHeading>

    <RecordSections record={record}/>

    <VStack as="section" gap={3} aria-label={t('record.documents')} className={styles.commitSection}>
      <Heading level={2}>{t('record.documents')}</Heading>
      <RecordDocuments label={t('record.documents')} changes={explained} useChange={commitChange(session, commit)} features={features} head={head} documentId={documentId}
        href={id => `/records/${encodeURIComponent(recordId)}#${encodeURIComponent(id)}`}/>
    </VStack>
  </VStack>;
}
