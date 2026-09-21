import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { historyOptions } from '../../../entities/project';
import { ActivityTimeline } from './ActivityTimeline';
import { ActivityDetailDialog } from './ActivityDetailDialog';
import { TimelineSkeleton } from './ViewSkeleton';
import type { ProductSearch } from '../model/search';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import styles from './product.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The activity timeline. Filters and the search word go to the server, which answers from all of history — a filter
 * finds changes that were never loaded, and the count is the whole count — fifty at a time.
 */
export function HistoryView({features,search,change,session,head}: {features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void;session:BrowserSessionV3;head:string|null}) {
  useLanguage();
 const filter={kind:search.kind,document:search.document,feature:search.feature,author:search.author,q:search.q};
 const filtering=Object.values(filter).some(Boolean);
 // While a new filter is answered the list that is on screen stays, instead of the page going blank.
 const query=useInfiniteQuery({...historyOptions(session,head??'',filter),enabled:!!head,placeholderData:keepPreviousData});
 const events=query.data?.pages.flatMap(p=>p.events)??[];
 const first=query.data?.pages[0];
 const selected=search.selected?events.find(e=>e.key===search.selected):undefined;
 const close=()=>change({...search,selected:undefined});
 const drawer=search.selected&&<ActivityDetailDialog key={search.selected} changeKey={search.selected} listed={selected} features={features} session={session} close={close}/>;
 if(!head) return <VStack gap={0}><PageState kind="empty" title={t('history.emptyTitle')} description={t('history.emptyDescription')}/>{drawer}</VStack>;
 // No padding of its own: the list it stands in for sits directly in the content, and a gap here shifted the swap.
 if(query.isPending) return <VStack gap={0}><TimelineSkeleton/></VStack>;
 if(query.error&&!first) return <RequestState error={query.error} retry={()=>{void query.refetch();}}/>;
 return <VStack gap={0}>
  {!!events.length&&<ActivityTimeline events={events} features={features} selected={selected}/>}
  {!events.length&&<PageState kind={filtering?'search':'empty'} title={t('history.emptyTitle')} description={filtering?t('history.changeFilters'):t('history.emptyDescription')}/>}
  {first&&!!first.total&&<VStack gap={3} padding={5} className={styles.historyPagination}>
   <Text type="supporting" color="secondary">{t('history.shown', { shown: events.length, total: first.total })} {query.hasNextPage?'':t('history.reachedEnd')}</Text>
   {first.boundary&&!query.hasNextPage&&<Text type="supporting" color="secondary">{t('history.legacyBoundary')}</Text>}
   {query.hasNextPage&&<Button label={query.isFetchingNextPage?t('history.loadingMore'):query.isFetchNextPageError?t('history.retryMore'):t('history.loadMore')} isDisabled={query.isFetching} onClick={()=>{void query.fetchNextPage();}}/>}
  </VStack>}
  {drawer}
 </VStack>;
}
