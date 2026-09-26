import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Link, useNavigate } from '@tanstack/react-router';
import { workingOptions } from '../../../entities/project';
import { KindToken } from '../../../entities/document';
import { decisionPreview } from '../../../widgets/activity-timeline';
import { RecordDocuments } from './RecordDocuments';
import { CommitSkeleton } from './CommitSkeleton';
import { listedWorking, workingChange } from '../model/working-change';
import type { WorkingSearch, WorkingTab } from '../model/working-search';
import styles from './commit.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The work that is not committed yet, laid out like a commit: the records written for the next commit, and the
 * documents changed since the last commit with their differences from it. It is worked out when the page is read and
 * kept until the header's refresh; source code is left to Git.
 */
export function WorkingView({ search, documentId, session, features, head }: { search: WorkingSearch; documentId?: string | undefined; session: BrowserSessionV3; features: IndexFeature[]; head: string | null }) {
  useLanguage();
  const navigate = useNavigate();
  const query = useQuery(workingOptions(session));
  const data = query.data;
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <CommitSkeleton label={t('working.loading')}/>;
  const tab: WorkingTab = search.tab ?? (documentId || !data.records.length ? 'documents' : 'records');
  const without = data.changes.filter(c => data.withoutRecord.includes(c.id));
  const choose = (next: string) => { void navigate({ to: '/records/working', search: { tab: next as WorkingTab } }); };
  return <VStack gap={0} as="article" aria-label={t('working.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <VStack gap={2} className={styles.commitHeading}>
      <Heading level={1}>{t('working.title')}</Heading>
      <Text color="secondary">{t('working.description')}</Text>
    </VStack>

    <TabList role="tablist" value={tab} onChange={choose} hasDivider>
      <Tab value="records" label={`${t('commit.tab.records')} ${data.records.length}`} panelId="working-records"/>
      <Tab value="documents" label={`${t('commit.tab.documents')} ${data.changes.length}`} panelId="working-documents"/>
    </TabList>

    {tab === 'records' && <VStack id="working-records" role="tabpanel" aria-label={t('event.records')} gap={3} className={styles.commitPanel}>
      {data.records.length ? <VStack as="ul" gap={0} className={styles.recordList}>
        {data.records.map(record => { const preview = decisionPreview(record);
          return <VStack as="li" key={record.id} gap={1} className={styles.recordEntry}>
            <HStack gap={3} className={styles.recordItemHead}>
              <HStack gap={2} vAlign="center">
                <Link to="/records/$recordId" params={{ recordId: record.id }} className={styles.recordLink}>{record.title}</Link>
                {record.draft && <Token label={t('working.draft')} color="yellow" size="sm"/>}
              </HStack>
              <Text type="supporting" color="secondary" className={styles.recordItemMeta}>{t('activity.recordCount', { count: record.docs.length })}</Text>
            </HStack>
            {preview && <Text type="supporting" color="secondary">{preview}</Text>}
          </VStack>; })}
      </VStack> : <Text color="secondary">{t('working.noRecords')}</Text>}
      {!!without.length && <VStack gap={2}>
        <Text color="secondary">{t('event.noRecord')}</Text>
        <HStack gap={2} wrap="wrap" className={styles.reasonRecords}>
          {without.map(c => <Link key={c.id} to="/records/working" search={{ tab: 'documents' }} hash={c.id} className={styles.reasonRecord}>
            <KindToken kind={c.kind}/>{c.title}
          </Link>)}
        </HStack>
      </VStack>}
    </VStack>}

    {tab === 'documents' && <VStack id="working-documents" role="tabpanel" aria-label={t('commit.documents')} gap={0} className={styles.commitPanel}>
      {data.changes.length ? <RecordDocuments label={t('commit.documents')} changes={data.changes.map(listedWorking)} useChange={workingChange(session)}
        features={features} head={head} documentId={documentId} href={id => `/records/working?tab=documents#${encodeURIComponent(id)}`}/>
        : <PageState isCompact title={t('working.noDocuments')}/>}
    </VStack>}
  </VStack>;
}
