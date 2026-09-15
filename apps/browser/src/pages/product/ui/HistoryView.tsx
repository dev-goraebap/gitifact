import type { SpecEvent, SpecFeature } from '@tryce/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { HistoryGraph } from './HistoryGraph';
import { EventDetail } from './EventDetail';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { HistoryTable } from './HistoryTable';
import { Layout, LayoutPanel } from '@astryxdesign/core/Layout';
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable';
import { useMediaQuery } from '@astryxdesign/core/hooks';
const names={created:'생성',modified:'수정',deleted:'삭제',moved:'이동'};
export function HistoryView({events,features,search,change}: {events:SpecEvent[];features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void}) {
 const selected=events.find(e=>e.key===search.selected);
 const filtered=events.filter(e=>(!search.document||(e.kind??'requirement')===search.document)&&(!search.feature||e.before?.specId===search.feature||e.after?.specId===search.feature)&&(!search.author||e.email===search.author)&&(!search.kind||e.types.includes(search.kind as keyof typeof names))&&(!search.q||[e.id,e.before?.title,e.after?.title].join(' ').toLowerCase().includes(search.q.toLowerCase())));
 const hasConnections = new Set(filtered.map(event => event.id)).size < filtered.length;
 const narrow=useMediaQuery('(max-width: 1023px)');
 const pane=useResizable({defaultSize:'52%',minSize:320,maxSize:'65%'});
 const detail=selected?<EventDetail features={features} key={selected.key} event={selected} close={()=>change({...search,selected:undefined})}/>:undefined;
 const list=<VStack gap={0} className={styles.timeline}>
  {!!filtered.length&&<VStack gap={0} className={`${styles.events} ${styles.inbox} ${hasConnections?'':styles.noGraph}`}><HistoryGraph events={filtered} selected={selected?.key}/><HistoryTable events={filtered} features={features} selected={selected} onOpen={e=>change({...search,selected:e.key})}/></VStack>}
  {search.selected&&!selected&&<Text>선택한 변경은 현재 불러온 범위에 없습니다. 이전 이력을 더 불러오세요.</Text>}
  {!filtered.length&&<PageState kind={events.length?'search':'empty'} title="표시할 명세 이력이 없습니다." description={events.length?'필터를 바꾸거나 이전 이력을 더 불러오세요.':'에이전트와 요구사항을 정리하고 커밋하면 이곳에서 변경 이력을 볼 수 있습니다.'}/>}
  {hasConnections&&<Text type="supporting" color="secondary">선은 현재 목록에 있는 같은 요구사항 또는 설계 문서의 변경만 연결합니다.</Text>}
 </VStack>;
 if(narrow)return detail??list;
 return <VStack className={styles.historyWorkspace} gap={0}><Layout padding={0} content={list} end={selected?<><ResizeHandle resizable={pane.props} isReversed hasDivider label="변경 상세 너비 조절"/><LayoutPanel role="region" label="읽기 패널" resizable={pane.props} padding={0} isScrollable>{detail}</LayoutPanel></>:undefined}/></VStack>;
}
