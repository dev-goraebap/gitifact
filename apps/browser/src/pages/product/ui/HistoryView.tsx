import type { SpecEvent, SpecFeature } from '@tryce/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { ActivityTimeline } from './ActivityTimeline';
import { ActivityDetailDialog } from './ActivityDetailDialog';
import type { ProductSearch } from '../model/search';
import { PageState } from '../../../shared/ui/page-state';
const names={created:'추가',modified:'변경',deleted:'제거',moved:'이동'};
export function HistoryView({events,features,search,change}: {events:SpecEvent[];features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void}) {
 const selected=events.find(e=>e.key===search.selected);
 const filtered=events.filter(e=>(!search.document||(e.kind??'requirement')===search.document)&&(!search.feature||e.before?.specId===search.feature||e.after?.specId===search.feature)&&(!search.author||e.email===search.author)&&(!search.kind||e.types.includes(search.kind as keyof typeof names))&&(!search.q||[e.id,e.before?.title,e.after?.title].join(' ').toLowerCase().includes(search.q.toLowerCase())));
 return <VStack gap={0}>
  {!!filtered.length&&<ActivityTimeline events={filtered} features={features} selected={selected}/>}
  {search.selected&&!selected&&<Text>선택한 변경은 현재 불러온 범위에 없습니다. 이전 이력을 더 불러오세요.</Text>}
  {!filtered.length&&<PageState kind={events.length?'search':'empty'} title="표시할 활동이 없습니다." description={events.length?'필터를 바꾸거나 이전 이력을 더 불러오세요.':'에이전트와 요구사항을 정리하고 커밋하면 이곳에서 변경 활동을 볼 수 있습니다.'}/>}
  {selected&&<ActivityDetailDialog key={selected.key} event={selected} features={features} close={()=>change({...search,selected:undefined})}/>}
 </VStack>;
}
