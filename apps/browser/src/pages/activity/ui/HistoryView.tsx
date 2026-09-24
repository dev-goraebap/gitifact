import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { historyOptions } from '../../../entities/project';
import { ActivityTimeline, TimelineSkeleton } from '../../../widgets/activity-timeline';
import type { RecordSearch } from '../../../widgets/records-page';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import styles from './activity.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The activity timeline. Filters and the search word go to the server, which answers from all of history — a filter
 * finds changes that were never loaded, and the count is the whole count — fifty at a time.
 */
export function HistoryView({features,search,session,head}: {features:SpecFeature[];search:RecordSearch;session:BrowserSessionV3;head:string|null}) {
  useLanguage();
 const filter={kind:search.kind,document:search.document,feature:search.feature,author:search.author,q:search.q};
 const filtering=Object.values(filter).some(Boolean);
 // While a new filter is answered the list that is on screen stays, instead of the page going blank.
 const query=useInfiniteQuery({...historyOptions(session,head??'',filter),enabled:!!head,placeholderData:keepPreviousData});
 const events=query.data?.pages.flatMap(p=>p.events)??[];
 const first=query.data?.pages[0];
 if(!head) return <PageState kind="empty" title={t('history.emptyTitle')} description={t('history.emptyDescription')}/>;
 // No padding of its own: the list it stands in for sits directly in the content, and a gap here shifted the swap.
 if(query.isPending) return <VStack gap={0}><TimelineSkeleton/></VStack>;
 if(query.error&&!first) return <RequestState error={query.error} retry={()=>{void query.refetch();}}/>;
 return <VStack gap={0}>
  {!!events.length&&<ActivityTimeline events={events} features={features}/>}
  {!events.length&&<PageState kind={filtering?'search':'empty'} title={t('history.emptyTitle')} description={filtering?t('history.changeFilters'):t('history.emptyDescription')}/>}
  {first&&!!first.total&&<VStack gap={3} padding={5} className={styles.historyPagination}>
   <Text type="supporting" color="secondary">{t('history.shown', { shown: events.length, total: first.total })} {query.hasNextPage?'':t('history.reachedEnd')}</Text>
   {query.hasNextPage&&<Button label={query.isFetchingNextPage?t('history.loadingMore'):query.isFetchNextPageError?t('history.retryMore'):t('history.loadMore')} isDisabled={query.isFetching} onClick={()=>{void query.fetchNextPage();}}/>}
  </VStack>}
 </VStack>;
}
