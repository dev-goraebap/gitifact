import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { ActivityTimeline } from './ActivityTimeline';
import { ActivityDetailDialog } from './ActivityDetailDialog';
import type { ProductSearch } from '../model/search';
import { PageState } from '../../../shared/ui/page-state';
import { t } from '../../../shared/i18n';
const names={created:t('change.created'),modified:t('change.modified'),deleted:t('change.deleted'),moved:t('change.moved')};
export function HistoryView({events,features,search,change}: {events:SpecEvent[];features:SpecFeature[];search:ProductSearch;change:(s:ProductSearch)=>void}) {
 const selected=events.find(e=>e.key===search.selected);
 const filtered=events.filter(e=>(!search.document||(e.kind??'requirement')===search.document)&&(!search.feature||e.before?.specId===search.feature||e.after?.specId===search.feature)&&(!search.author||e.email===search.author)&&(!search.kind||e.types.includes(search.kind as keyof typeof names))&&(!search.q||[e.id,e.before?.title,e.after?.title].join(' ').toLowerCase().includes(search.q.toLowerCase())));
 return <VStack gap={0}>
  {!!filtered.length&&<ActivityTimeline events={filtered} features={features} selected={selected}/>}
  {search.selected&&!selected&&<Text>{t('history.selectedMissing')}</Text>}
  {!filtered.length&&<PageState kind={events.length?'search':'empty'} title={t('history.emptyTitle')} description={events.length?t('history.changeFilters'):t('history.emptyDescription')}/>}
  {selected&&<ActivityDetailDialog key={selected.key} event={selected} features={features} close={()=>change({...search,selected:undefined})}/>}
 </VStack>;
}
