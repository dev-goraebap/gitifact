import { useDeferredValue, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { commitOptions, recordOptions } from '../../../entities/project';
import { LoadMore } from '../../../shared/ui/load-more';
import { RecordDocuments } from './RecordDocuments';
import { commitChange, listed, loadedCommit } from '../model/commit-changes';
import { CommitHeading } from './CommitHeading';
import { RecordCommit } from './RecordCommit';
import { RecordSections } from './RecordSections';
import { WorkingRecord } from './WorkingRecord';
import { ApiError } from '../../../shared/api/client';
import styles from './commit.module.css';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One record as its own page: its title and sections, each document it explains with its differences, and a card for
 * the commit that added it. The commit's other records and its source code belong to the commit, so the card links to
 * them on the commit page. The record is found through the history of the HEAD the reader is on; the documents it
 * explains come from its commit twenty at a time, the server picking them, and their text is read when one is opened.
 */

export function RecordView({ recordId, documentId, session, features, head }: { recordId: string; documentId?: string | undefined; session: BrowserSessionV3; features: IndexFeature[]; head: string }) {
  useLanguage();
  const found = useQuery(recordOptions(session, head, recordId));
  const commit = found.data?.commit;
  const query = useInfiniteQuery({ ...commitOptions(session, commit ?? '', recordId), enabled: !!commit });
  // The changes are drawn in the background, so the loader keeps moving while a large commit is laid out.
  const data = loadedCommit(useDeferredValue(query.data));
  useEffect(() => { if (data && documentId) document.getElementById(documentId)?.scrollIntoView({ block: 'start' }); }, [data, documentId]);
  // A record HEAD's history does not have may be one not committed yet, which the uncommitted work names.
  if (found.error instanceof ApiError && found.error.code === 'NOT_FOUND') return <WorkingRecord recordId={recordId} documentId={documentId} session={session} features={features} head={head}/>;
  const error = found.error ?? query.error;
  if (error) return <RequestState error={error} retry={() => { void (found.error ? found.refetch() : query.refetch()); }}/>;
  if (!data || !commit || !found.data) return <RequestState/>;
  const record = found.data.record;
  const explained = data.changes.map(listed);
  return <VStack gap={0} as="article" aria-label={t('record.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <CommitHeading title={record.title} commit={data}
      hash={<Link to="/records/commits/$commit" params={{ commit }} className={styles.commitHashLink}>{commit.slice(0, 12)}</Link>}>
      <HStack gap={2} className={styles.recordCommit}>
        <Text type="supporting" color="secondary">{record.id}</Text>
        <Text type="supporting" color="secondary" aria-hidden>·</Text>
        <Link to="/records/commits/$commit" params={{ commit }} className={styles.recordCommitMessage}>{data.message}</Link>
      </HStack>
      <RecordCommit session={session} commit={commit} others={found.data.others}/>
    </CommitHeading>

    <RecordSections record={record}/>

    <VStack as="section" gap={3} aria-label={t('record.documents')} className={styles.commitSection}>
      <Heading level={2}>{t('record.documents')}</Heading>
      <RecordDocuments label={t('record.documents')} changes={explained} useChange={commitChange(session, commit)} features={features} head={head} documentId={documentId}
        more={<LoadMore label={t('commit.moreDocuments')} query={query}/>} href={id => `/records/${encodeURIComponent(recordId)}#${encodeURIComponent(id)}`}/>
    </VStack>
  </VStack>;
}
