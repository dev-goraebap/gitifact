import { useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV1 } from '@gitifact/contracts';
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
export function ProductPanel({session,view,featureId,email,documentId,search,change}:ProductProps&{session:BrowserSessionV1}) {
 const guides=view==='guides'; const productPage=view==='product';
 const query=useInfiniteQuery(specsOptions(session));
 const disconnected=query.error instanceof ApiError && query.error.code==='SESSION_CHANGED';
 const first=disconnected?undefined:query.data?.pages[0];
 // The skeleton waits 200ms before appearing and then stays at least 300ms, so fast answers never flash and slow ones never blink.
 const skeleton=useLoadingHold(!first&&!query.error);
 const ready=!!first&&!skeleton;
 const events=[...new Map((query.data?.pages.flatMap(p=>p.events)??[]).map(e=>[e.key,e])).values()];
 const title={history:'활동',features:'요구사항',contributors:'참여자',product:'제품 개요',guides:'지침'}[view];
 const detailFeature=featureId?first?.features.find(f=>f.id===featureId):undefined;
 const detailPerson=email?first?.contributors.find(p=>p.email===email):undefined;
 const detailDocument=documentId?first?.documents.find(d=>d.id===documentId):undefined;
 // Detail pages and the product dashboard carry their own heading; the guide browser fills the whole content area with columns.
 const detailPage=!!(featureId||email||documentId)||productPage;
 const browsing=guides&&!documentId;
 const root={history:'/',features:'/features',contributors:'/contributors',product:'/product',guides:'/guides'}[view];
 const trail=[{label:title,to:root},...(detailFeature?[{label:detailFeature.title}]:[]),...(detailPerson?[{label:detailPerson.name}]:[]),...(detailDocument?[{label:detailDocument.title}]:[])];
 const filters=ready&&!detailPage&&!guides&&<HStack gap={3} wrap="wrap" className={`${styles.filters} ${styles.filtersSticky}`}><TextInput label="검색" isLabelHidden placeholder={view==='features'?'기능·요구사항 검색':view==='contributors'?'이름 또는 이메일 검색':'이름 또는 ID 검색'} value={search.q??''} hasClear onChange={q=>change({...search,q:q||undefined},true)}/>
 {view==='history'&&<><Selector label="기능 필터" isLabelHidden value={search.feature??''} options={[{value:'',label:'모든 기능'},...first.features.map(f=>({value:f.id,label:f.title}))]} onChange={feature=>change({...search,feature:feature||undefined})}/>
 <Selector label="명세 종류" isLabelHidden value={search.document??''} options={[{value:'',label:'전체 명세'},{value:'requirement',label:'요구사항'},{value:'design',label:'설계'},{value:'product',label:'제품 문서'},{value:'guide',label:'지침 문서'}]} onChange={document=>change({...search,document:document||undefined})}/>
 <Selector label="변경 종류" isLabelHidden value={search.kind??''} options={[{value:'',label:'모든 변경'},{value:'created',label:'추가'},{value:'modified',label:'변경'},{value:'moved',label:'이동'},{value:'deleted',label:'제거'}]} onChange={kind=>change({...search,kind:kind||undefined})}/>
 <Selector label="작성자 필터" isLabelHidden value={search.author??''} options={[{value:'',label:'모든 작성자'},...first.contributors.map(p=>({value:p.email,label:p.name}))]} onChange={author=>change({...search,author:author||undefined})}/></>}
 </HStack>;
 const actions=<HStack gap={3} className={styles.headerActions}>
 {first&&<Text type="supporting" color="secondary" className={styles.headerTime}><time dateTime={first.observedAt}>{new Date(first.observedAt).toLocaleString()}</time> 조회</Text>}
 <IconButton label="새로고침" icon={<HgiRefresh/>} variant="ghost" size="sm" isLoading={query.isFetching} isDisabled={query.isFetching} onClick={()=>{void query.refetch();}}/>
 </HStack>;
 const notes=first&&(first.boundary||first.contributorsLimited)&&<HStack gap={3} wrap="wrap">{first.boundary&&<Text type="supporting" color="secondary">새 명세 도입 이전의 구형 기록은 표시하지 않습니다.</Text>}{first.contributorsLimited&&<Text type="supporting">참여자는 최근 10,000개 Git 커밋 기준입니다.</Text>}</HStack>;
 return <VStack gap={0} className={browsing?styles.pageFill:styles.page}>
 <PageHeader trail={trail} actions={actions}/>
 <VStack gap={0} className={browsing?styles.fill:styles.column}>
 {!detailPage&&!guides&&<VStack gap={1} className={styles.pageTitle}><Heading level={1}>{title}</Heading></VStack>}
 {query.error&&first&&<VStack padding={4} role="alert"><Text>{query.error.message}</Text><Text>이전 조회 자료입니다. 현재 상태로 확정하지 마세요.</Text></VStack>}
 {!first&&query.error&&<RequestState error={query.error} retry={()=>{if(disconnected)window.location.reload();else void query.refetch();}}/>}
 {skeleton&&<ViewSkeleton view={view}/>}
 {filters}
 {ready&&<VStack gap={3} className={browsing?styles.fillContent:styles.content}>
 {view==='history'?<HistoryView events={events} features={first.features} search={search} change={change}/>:view==='features'?<FeatureView features={first.features} featureId={featureId} search={search} change={change}/>:productPage?<ProductOverview product={first.documents.find(d=>d.kind==='product')} features={first.features} documents={first.documents} events={events} contributors={first.contributors} working={first.working}/>:guides?<DocumentsView documents={first.documents.filter(d=>d.kind==='guide')} kind="guide" documentId={documentId} search={search} change={change}/>:<ContributorsView people={first.contributors} events={events} features={first.features} email={email} search={search}/>}
 {view==='history'&&<VStack gap={3} padding={5} className={styles.historyPagination}>
 <Text type="supporting" color="secondary">{events.length}개 이력을 불러왔습니다.{query.hasNextPage?' 검색·필터는 불러온 범위에 적용됩니다.':' 마지막 이력까지 확인했습니다.'}</Text>
 {query.hasNextPage&&<Button label={query.isFetchingNextPage?'이전 이력 불러오는 중…':query.isFetchNextPageError?'이전 이력 다시 불러오기':'이전 이력 더 보기'} isDisabled={query.isFetching} onClick={()=>{void query.fetchNextPage();}}/>}
 </VStack>}
 {!browsing&&notes}
 </VStack>}
 </VStack>
 </VStack>;
}
