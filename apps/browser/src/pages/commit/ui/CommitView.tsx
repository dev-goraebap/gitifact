import { useDeferredValue, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Link, useNavigate } from '@tanstack/react-router';
import { commitFilesOptions, commitOptions } from '../../../entities/project';
import { KindToken } from '../../../entities/document';
import { decisionPreview, groupRecords } from '../../../widgets/activity-timeline';
import { RecordDocuments } from './RecordDocuments';
import { LoadMore } from '../../../shared/ui/load-more';
import { commitChange, listed, loadedCommit } from '../model/commit-changes';
import { CommitCode } from './CommitCode';
import { CommitHeading } from './CommitHeading';
import type { CommitSearch, CommitTab } from '../model/commit-search';
import styles from './commit.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One commit, read as it was made: who wrote it, then its three parts as tabs — the records it added, the documents it
 * changed with their differences, and its source code. Each part has its own address, so a record page can send the
 * reader straight to the code, and a link that names a document opens the documents at that section. The documents
 * come twenty at a time without their text; the chosen one's text is read when it is opened.
 */
export function CommitView({ commit, search, documentId, session, features, head }: { commit: string; search: CommitSearch; documentId?: string | undefined; session: BrowserSessionV3; features: IndexFeature[]; head: string | null }) {
  useLanguage();
  const navigate = useNavigate();
  const query = useInfiniteQuery(commitOptions(session, commit));
  const files = useInfiniteQuery(commitFilesOptions(session, commit));
  // The changes are drawn in the background, so the loader keeps moving while a large commit is laid out.
  const data = loadedCommit(useDeferredValue(query.data));
  const groups = data ? groupRecords(data.changes) : [];
  const recorded = groups.filter(group => group.record);
  const tab: CommitTab = search.tab ?? (documentId || !recorded.length ? 'documents' : 'records');
  // An address typed or shared from outside names its section before the page has drawn it, so the page lands on it.
  useEffect(() => { if (data && documentId && tab === 'documents') document.getElementById(documentId)?.scrollIntoView({ block: 'start' }); }, [data, documentId, tab]);
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!data) return <RequestState/>;
  const bare = groups.find(group => !group.record && group.missing);
  const choose = (next: string) => { void navigate({ to: '/records/commits/$commit', params: { commit }, search: { tab: next as CommitTab } }); };
  const count = (n: number | undefined) => n === undefined ? '' : ` ${n}`;
  return <VStack gap={0} as="article" aria-label={t('commit.title')} className={styles.commitPage}>
    <Link to="/records" className={styles.commitBack}>{t('commit.back')}</Link>
    <CommitHeading title={data.message} commit={data}/>

    <TabList role="tablist" value={tab} onChange={choose} hasDivider>
      <Tab value="records" label={t('commit.tab.records') + count(recorded.length)} panelId="commit-records"/>
      <Tab value="documents" label={t('commit.tab.documents') + count(data.total)} panelId="commit-documents"/>
      <Tab value="code" label={t('commit.tab.code') + count(files.data?.pages[0]?.total)} panelId="commit-code"/>
    </TabList>

    {tab === 'records' && <VStack id="commit-records" role="tabpanel" aria-label={t('event.records')} gap={3} className={styles.commitPanel}>
      {recorded.length ? <VStack as="ul" gap={0} className={styles.recordList}>
        {recorded.map(group => { const preview = decisionPreview(group.record!);
          return <VStack as="li" key={group.key} gap={1} className={styles.recordEntry}>
            <HStack gap={3} className={styles.recordItemHead}>
              <Link to="/records/$recordId" params={{ recordId: group.record!.id }} className={styles.recordLink}>{group.record!.title}</Link>
              <Text type="supporting" color="secondary" className={styles.recordItemMeta}>{t('activity.recordCount', { count: group.events.length })}</Text>
            </HStack>
            {preview && <Text type="supporting" color="secondary">{preview}</Text>}
          </VStack>; })}
      </VStack> : <Text color="secondary">{t('event.noRecords')}</Text>}
      <LoadMore label={t('commit.moreRecords')} query={query}/>
      {bare && <VStack gap={2}>
        <Text color="secondary">{t('event.noRecord')}</Text>
        <HStack gap={2} wrap="wrap" className={styles.reasonRecords}>
          {bare.events.map(e => <Link key={e.key} to="/records/commits/$commit" params={{ commit }} search={{ tab: 'documents' }} hash={e.id} className={styles.reasonRecord}>
            <KindToken kind={e.kind}/>{(e.after ?? e.before)?.title ?? e.id}
          </Link>)}
        </HStack>
      </VStack>}
    </VStack>}

    {tab === 'documents' && <VStack id="commit-documents" role="tabpanel" aria-label={t('commit.documents')} gap={0} className={styles.commitPanel}>
      {data.changes.length ? <RecordDocuments label={t('commit.documents')} changes={data.changes.map(listed)} useChange={commitChange(session, commit)}
        features={features} head={head} documentId={documentId} more={<LoadMore label={t('commit.moreDocuments')} query={query}/>}
        href={id => `/records/commits/${encodeURIComponent(commit)}?tab=documents#${encodeURIComponent(id)}`}/>
        : <PageState isCompact title={t('commit.noDocuments')} description={t('commit.noDocumentsDescription')}/>}
    </VStack>}

    {tab === 'code' && <VStack id="commit-code" role="tabpanel" aria-label={t('source.title')} gap={0} className={styles.commitPanel}>
      <CommitCode session={session} commit={commit} file={search.file}
        href={path => `/records/commits/${encodeURIComponent(commit)}?tab=code&file=${encodeURIComponent(path)}`}/>
    </VStack>}
  </VStack>;
}
