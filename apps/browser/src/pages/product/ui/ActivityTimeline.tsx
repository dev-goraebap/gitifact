import type { SpecEvent, SpecFeature } from '@tryce/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { Person } from './Person';
import styles from './product.module.css';
const names = {created:'추가',modified:'변경',deleted:'제거',moved:'이동'};
const colors = {created:'green',modified:'blue',deleted:'red',moved:'purple'} as const;
/** Vertical timeline: one rail on the left, each entry's avatar sits on the rail. */
export function ActivityTimeline({events,features,selected}: {events:SpecEvent[];features:SpecFeature[];selected:SpecEvent|undefined}) {
 return <VStack as="ol" aria-label="활동 목록" gap={0} className={styles.timeline}>
  {events.map((e,index)=>{
   const spec=e.after??e.before;const feature=features.find(f=>f.id===spec?.specId);
   const kind=e.types.includes('deleted')?'deleted':e.types.includes('modified')?'modified':e.types.includes('moved')?'moved':'created';
   const sameCommit=index>0&&events[index-1]!.commit===e.commit;
   return <HStack as="li" key={e.key} gap={4} className={`${styles.entry} ${sameCommit?styles.entryContinued:''}`} aria-current={selected?.key===e.key?true:undefined}>
    <VStack gap={0} className={styles.entryAvatar}><Person name={e.author} email={e.email} avatarOnly/></VStack>
    <VStack gap={1} className={styles.entryBody}>
     <HStack gap={3} className={styles.entryHead}>
      <Text weight="semibold" maxLines={1}>{e.author}</Text>
      <Timestamp value={e.date} format="relative"/>
     </HStack>
     <HStack gap={2} wrap="wrap" className={styles.entryLine}>
      <Token label={e.types.map(t=>names[t]).join(' · ')} color={colors[kind]}/>
      <Text type="supporting" color="secondary">{e.kind==='design'?'설계':'요구사항'}</Text>
      <Link to="/" search={s=>({...s,selected:e.key})} className={styles.entryTitle}>{spec?.title??e.id}</Link>
      {feature&&<Text type="supporting" color="secondary">·</Text>}
      {feature&&<Link to="/features" search={{feature:feature.id}} className={styles.entryFeature}>{feature.title}</Link>}
     </HStack>
     <HStack gap={2} className={styles.entryLine}>
      <Text type="code" color="secondary">{e.commit.slice(0,7)}</Text>
      <Text type="supporting" color="secondary" maxLines={1}>{e.reasons.length?e.reasons.join(' · '):'변경 이유가 기록되지 않았습니다.'}</Text>
     </HStack>
    </VStack>
   </HStack>;
  })}
 </VStack>;
}
