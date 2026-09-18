import { useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV2 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HgiRefresh } from '../../../shared/ui/icons/HgiRefresh';
import { specsOptions } from '../../../entities/project';
import { ApiError } from '../../../shared/api/client';
import type { ProductProps } from './ProductPage';
import { HistoryView } from './HistoryView';
import { FeatureView } from './FeatureView';
import { ContributorsView } from './ContributorsView';
import { DocumentsView } from './DocumentsView';
import { ProductOverview } from './ProductOverview';
import styles from './product.module.css';
import { RequestState } from '../../../shared/ui/request-state';
import { PageHeader } from '../../../widgets/page-header';
import { useLoadingHold } from '../../../shared/ui/request-state/useLoadingHold';
import { ViewSkeleton } from './ViewSkeleton';
import { t, tNodes } from '../../../shared/i18n';
import { DocumentIndexProvider } from '../../../shared/ui/document';
export function ProductPanel({session,view,featureId,email,documentId,search,change}:ProductProps&{session:BrowserSessionV2}) {
 const wiki=view==='wiki'; const productPage=view==='product';
 const query=useInfiniteQuery(specsOptions(session));
 const disconnected=query.error instanceof ApiError && query.error.code==='SESSION_CHANGED';
 const first=disconnected?undefined:query.data?.pages[0];
 // The skeleton waits 200ms before appearing and then stays at least 300ms, so fast answers never flash and slow ones never blink.
 const skeleton=useLoadingHold(!first&&!query.error);
 const ready=!!first&&!skeleton;
 const events=[...new Map((query.data?.pages.flatMap(p=>p.events)??[]).map(e=>[e.key,e])).values()];
 const title={history:t('nav.history'),features:t('nav.features'),contributors:t('nav.contributors'),product:t('nav.product'),wiki:t('nav.wiki')}[view];
 const detailFeature=featureId?first?.features.find(f=>f.id===featureId):undefined;
 const detailPerson=email?first?.contributors.find(p=>p.email===email):undefined;
 const detailDocument=documentId?first?.documents.find(d=>d.id===documentId):undefined;
 // Detail pages and the product dashboard carry their own heading; the wiki explorer fills the whole content area with its tree and pane.
 const detailPage=!!(featureId||email||documentId)||productPage;
 const browsing=wiki;
 const root={history:'/',features:'/features',contributors:'/contributors',product:'/product',wiki:'/wiki'}[view];
 const trail=[{label:title,to:root},...(detailFeature?[{label:detailFeature.title}]:[]),...(detailPerson?[{label:detailPerson.name}]:[]),...(detailDocument?[{label:detailDocument.title}]:[])];
 const filters=ready&&!detailPage&&!wiki&&<HStack gap={3} wrap="wrap" className={`${styles.filters} ${styles.filtersSticky}`}><TextInput label={t('filters.search')} isLabelHidden placeholder={view==='features'?t('filters.searchFeatures'):view==='contributors'?t('filters.searchContributors'):t('filters.searchEvents')} value={search.q??''} hasClear onChange={q=>change({...search,q:q||undefined},true)}/>
 {view==='history'&&<><Selector label={t('filters.feature')} isLabelHidden value={search.feature??''} options={[{value:'',label:t('filters.allFeatures')},...first.features.map(f=>({value:f.id,label:f.title}))]} onChange={feature=>change({...search,feature:feature||undefined})}/>
 <Selector label={t('filters.document')} isLabelHidden value={search.document??''} options={[{value:'',label:t('filters.allDocuments')},{value:'requirement',label:t('kind.requirement')},{value:'design',label:t('kind.design')},{value:'wiki',label:t('kind.wiki')}]} onChange={document=>change({...search,document:document||undefined})}/>
 <Selector label={t('filters.change')} isLabelHidden value={search.kind??''} options={[{value:'',label:t('filters.allChanges')},{value:'created',label:t('change.created')},{value:'modified',label:t('change.modified')},{value:'moved',label:t('change.moved')},{value:'deleted',label:t('change.deleted')}]} onChange={kind=>change({...search,kind:kind||undefined})}/>
 <Selector label={t('filters.author')} isLabelHidden value={search.author??''} options={[{value:'',label:t('filters.allAuthors')},...first.contributors.map(p=>({value:p.email,label:p.name}))]} onChange={author=>change({...search,author:author||undefined})}/></>}
 </HStack>;
 const actions=<HStack gap={3} className={styles.headerActions}>
 {first&&<Text type="supporting" color="secondary" className={styles.headerTime}>{tNodes('header.observedAt', { time: <time dateTime={first.observedAt}>{new Date(first.observedAt).toLocaleString()}</time> })}</Text>}
 <IconButton label={t('common.refresh')} icon={<HgiRefresh/>} variant="ghost" size="sm" isLoading={query.isFetching} isDisabled={query.isFetching} onClick={()=>{void query.refetch();}}/>
 </HStack>;
 const notes=first&&(first.boundary||first.contributorsLimited)&&<HStack gap={3} wrap="wrap">{first.boundary&&<Text type="supporting" color="secondary">{t('history.legacyBoundary')}</Text>}{first.contributorsLimited&&<Text type="supporting">{t('history.contributorsLimited')}</Text>}</HStack>;
 return <VStack gap={0} className={browsing?styles.pageFill:styles.page}>
 <PageHeader trail={trail} actions={actions}/>
 <VStack gap={0} className={browsing?styles.fill:styles.column}>
 {!detailPage&&!wiki&&<VStack gap={1} className={styles.pageTitle}><Heading level={1}>{title}</Heading></VStack>}
 {query.error&&first&&<VStack padding={4} role="alert"><Text>{query.error.message}</Text><Text>{t('history.staleData')}</Text></VStack>}
 {!first&&query.error&&<RequestState error={query.error} retry={()=>{if(disconnected)window.location.reload();else void query.refetch();}}/>}
 {skeleton&&<ViewSkeleton view={view}/>}
 {filters}
 {ready&&<VStack gap={3} className={browsing?styles.fillContent:styles.content}>
 <DocumentIndexProvider index={first}>{view==='history'?<HistoryView events={events} features={first.features} search={search} change={change}/>:view==='features'?<FeatureView features={first.features} featureId={featureId} search={search} change={change}/>:productPage?<ProductOverview features={first.features} documents={first.documents} events={events} contributors={first.contributors} working={first.working}/>:wiki?<DocumentsView documents={first.documents} documentId={documentId} search={search} change={change}/>:<ContributorsView people={first.contributors} events={events} features={first.features} email={email} search={search}/>}</DocumentIndexProvider>
 {view==='history'&&<VStack gap={3} padding={5} className={styles.historyPagination}>
 <Text type="supporting" color="secondary">{t('history.loaded', { count: events.length })} {query.hasNextPage?t('history.filtersApplyToLoaded'):t('history.reachedEnd')}</Text>
 {query.hasNextPage&&<Button label={query.isFetchingNextPage?t('history.loadingMore'):query.isFetchNextPageError?t('history.retryMore'):t('history.loadMore')} isDisabled={query.isFetching} onClick={()=>{void query.fetchNextPage();}}/>}
 </VStack>}
 {!browsing&&notes}
 </VStack>}
 </VStack>
 </VStack>;
}
