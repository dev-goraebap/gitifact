import { useDeferredValue } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { historyOptions } from '../../../entities/project';
import { ActivityTimeline } from '../../../widgets/activity-timeline';
import { WorkingEntry } from './WorkingEntry';
import type { RecordSearch } from '../../../widgets/records-page';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import styles from './activity.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The activity timeline. Filters and the search word go to the server, which answers from all of history — a filter
 * finds changes that were never loaded, and the count is the whole count — twenty commits at a time, each whole.
 * The work not committed yet comes first while no filter is set.
 */
export function HistoryView({features,search,session,head}: {features:IndexFeature[];search:RecordSearch;session:BrowserSessionV3;head:string|null}) {
  useLanguage();
 const filter={kind:search.kind,document:search.document,feature:search.feature,author:search.author,q:search.q};
 const filtering=Object.values(filter).some(Boolean);
 // While a new filter is answered the list that is on screen stays, instead of the page going blank.
 const query=useInfiniteQuery({...historyOptions(session,head??'',filter),enabled:!!head,placeholderData:keepPreviousData});
 // Drawn in the background, so the loader keeps moving while a long timeline is laid out.
 const data=useDeferredValue(query.data);
 const events=data?.pages.flatMap(p=>p.events)??[];
 const first=data?.pages[0];
 if(!head) return <PageState kind="empty" title={t('history.emptyTitle')} description={t('history.emptyDescription')}/>;
 if(query.isPending||(!data&&!query.error)) return <RequestState/>;
 if(query.error&&!first) return <RequestState error={query.error} retry={()=>{void query.refetch();}}/>;
 return <VStack gap={0}>
  {!filtering&&<WorkingEntry session={session}/>}
  {!!events.length&&<ActivityTimeline events={events} features={features}/>}
  {!events.length&&<PageState kind={filtering?'search':'empty'} title={t('history.emptyTitle')} description={filtering?t('history.changeFilters'):t('history.emptyDescription')}/>}
  {first&&!!first.total&&<VStack gap={3} padding={5} className={styles.historyPagination}>
   <Text type="supporting" color="secondary">{t('history.shown', { shown: events.length, total: first.total })} {query.hasNextPage?'':t('history.reachedEnd')}</Text>
   {query.hasNextPage&&<Button label={query.isFetchingNextPage?t('history.loadingMore'):query.isFetchNextPageError?t('history.retryMore'):t('history.loadMore')} isDisabled={query.isFetching} onClick={()=>{void query.fetchNextPage();}}/>}
  </VStack>}
 </VStack>;
}
