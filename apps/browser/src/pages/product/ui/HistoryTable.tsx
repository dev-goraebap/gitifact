import type { SpecEvent, SpecFeature } from '@tryce/contracts';
import { Table, pixel, proportional, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Person } from './Person';

const names = {created:'생성',modified:'수정',deleted:'삭제',moved:'이동'};
export function HistoryTable({events,features,selected,onOpen}: {
 events:SpecEvent[]; features:SpecFeature[]; selected:SpecEvent|undefined; onOpen:(event:SpecEvent)=>void;
}) {
 const mobile = useMediaQuery('(max-width: 767px)');
 const compact = mobile || !!selected;
 const columns:TableColumn<SpecEvent>[] = [];
 columns.push({key:'author',header:compact?'':'작성자',width:pixel(compact?44:160),renderCell:e=><Person name={e.author} email={e.email} avatarOnly={compact}/>});
 columns.push({key:'title',header:'요구사항 · 변경 후',width:proportional(1,{minWidth:140}),renderCell:e=><VStack gap={1}>
  <Text weight="semibold" maxLines={1}>{(e.after??e.before)?.title??e.id}</Text>
  <Text type="supporting" color="secondary" maxLines={1}>{e.after?e.after.body.replace(/<!--[^]*?-->/g,'').replace(/[#*_`]/g,'').replace(/\s+/g,' ').trim():'삭제된 요구사항입니다.'}</Text>
 </VStack>});
 if(!compact) columns.push({key:'feature',header:'기능',width:pixel(164),renderCell:e=><Text color="secondary" maxLines={1}>{features.find(f=>f.id===(e.after??e.before)?.specId)?.title??(e.after??e.before)?.path}</Text>});
 columns.push({key:'types',header:'변경',width:pixel(mobile?68:86),renderCell:e=><Token label={e.types.map(t=>names[t]).join(' · ')} color={e.types.includes('deleted')?'red':e.types.includes('modified')?'blue':e.types.includes('moved')?'purple':'default'}/>});
 if(!compact) columns.push({key:'date',header:'시각',align:'end',width:pixel(96),renderCell:e=><VStack gap={1}>
  <Text type="supporting" color="secondary">{new Date(e.date).toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</Text>
  <Text type="supporting" color="secondary">{new Date(e.date).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</Text>
 </VStack>});
 const interaction:TablePlugin<SpecEvent> = {transformBodyRow:(props,item)=>({...props,htmlProps:{...props.htmlProps,
  tabIndex:0,'aria-current':selected?.key===item.key?true:undefined,
  onClick:()=>onOpen(item),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpen(item);}}
 }})};
 return <Table data={events} idKey="key" columns={columns} plugins={{interaction}} density="compact" dividers="rows" hasHover textOverflow="truncate"/>;
}
