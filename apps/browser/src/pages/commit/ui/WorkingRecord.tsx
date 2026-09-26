import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Link } from '@tanstack/react-router';
import { workingOptions } from '../../../entities/project';
import { RecordDocuments } from './RecordDocuments';
import { RecordSections } from './RecordSections';
import { listedWorking, workingChange } from '../model/working-change';
import styles from './commit.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * A record not committed yet, at the same address a committed one has: its sections and the uncommitted changes of the
 * documents it names, compared with the last commit. It has no commit, author or time until it is committed.
 */
export function WorkingRecord({ recordId, documentId, session, features, head }: { recordId: string; documentId?: string | undefined; session: BrowserSessionV3; features: IndexFeature[]; head: string | null }) {
  useLanguage();
  const query = useQuery(workingOptions(session));
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <RequestState/>;
  const record = query.data.records.find(r => r.id === recordId);
  if (!record) return <PageState isCompact title={t('record.missing')}/>;
  const explained = query.data.changes.filter(c => record.docs.includes(c.id)).map(listedWorking);
  return <VStack gap={0} as="article" aria-label={t('record.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <VStack gap={4} className={styles.commitHeading}>
      <Heading level={1}>{record.title}</Heading>
      <HStack gap={2} className={styles.recordCommit}>
        <Text type="supporting" color="secondary">{record.id}</Text>
        <Text type="supporting" color="secondary" aria-hidden>·</Text>
        <Link to="/records/working" className={styles.recordCommitMessage}>{t('working.title')}</Link>
        {record.draft && <Token label={t('working.draft')} color="yellow" size="sm"/>}
      </HStack>
    </VStack>
    <RecordSections record={record}/>
    <VStack as="section" gap={3} aria-label={t('record.documents')} className={styles.commitSection}>
      <Heading level={2}>{t('record.documents')}</Heading>
      {explained.length ? <RecordDocuments label={t('record.documents')} changes={explained} useChange={workingChange(session)} features={features} head={head} documentId={documentId}
        href={id => `/records/${encodeURIComponent(recordId)}#${encodeURIComponent(id)}`}/>
        : <Text color="secondary">{t('working.noExplained')}</Text>}
    </VStack>
  </VStack>;
}
