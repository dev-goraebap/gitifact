import { memo } from 'react';
import type { SpecEvent, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { groupRecords } from '../model/activity-groups';
import { Person } from '../../../entities/contributor';
import { TimelineRecord } from './TimelineRecord';
import { RecordRow } from './RecordRow';
import styles from './timeline.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** `hidden` counts the commit's records this list leaves out — the overview shows a few of a large commit. */
type Props = {events:SpecEvent[];day:string|undefined;features:IndexFeature[];hidden:number};
/** Records a commit lists before the rest are left to its page: a commit may add a hundred. */
const RECORDS_SHOWN = 3;

/** Names the day a marker stands for when the reader still counts it by name; other days are left to the date. */
function nearbyDay(iso:string) {
 const midnight=(value:Date)=>new Date(value.getFullYear(),value.getMonth(),value.getDate()).getTime();
 const days=Math.round((midnight(new Date())-midnight(new Date(iso)))/86_400_000);
 return days===0?t('activity.today'):days===1?t('activity.yesterday'):undefined;
}

/**
 * One commit: who made it and when, which commit it was, then a row per record it added — its title opens the record's
 * page — up to three, the rest left to the commit's page. Changes no record explains come last with their documents,
 * shown only when one should have had a record (a document changed, moved or deleted).
 * Its props are the event and feature objects the queries keep between renders and are compared by identity, so
 * "load more" draws the new commits and leaves the ones already on screen alone; before the list was grouped every
 * press drew the whole list again and took longer the more had been loaded.
 */
export const TimelineCommit = memo(function TimelineCommit({events,day,features,hidden}: Props) {
  useLanguage();
 const first=events[0]!;
 const groups=groupRecords(events);
 const recorded=groups.filter(group=>group.record);
 const bare=groups.find(group=>!group.record);
 return <VStack as="li" gap={0} className={styles.commit}>
  {day&&<HStack gap={2} className={styles.day}>
   <Text type="supporting" weight="semibold">{nearbyDay(day)}</Text>
   <Text type="supporting" color="secondary"><Timestamp value={day} format="date_weekday" hasTooltip={false}/></Text>
  </HStack>}
  <HStack gap={4} className={styles.commitRow}>
   <VStack gap={0} className={styles.commitNode}><Person name={first.author} email={first.email} avatarOnly/></VStack>
   <VStack gap={5} className={styles.commitBody}>
    <VStack gap={1} className={styles.commitHead}>
     <HStack gap={3} className={styles.commitWho}>
      <Link to="/contributors/$email" params={{email:first.email}} className={styles.commitAuthor}>{first.author}</Link>
      <HStack gap={3} className={styles.commitWhen}>
       {!!recorded.length&&<Text type="supporting" color="secondary">{t('activity.commitRecords', { count: recorded.length })}</Text>}
       {events.length+hidden>1&&<Text type="supporting" color="secondary">{t('activity.recordCount', { count: events.length+hidden })}</Text>}
       <Timestamp value={first.date} format="relative"/>
      </HStack>
     </HStack>
     <Link to="/records/commits/$commit" params={{commit:first.commit}} className={styles.commitMetaLink}>
      <HStack gap={2} className={styles.commitMeta}>
       <Text type="code" color="secondary">{first.commit.slice(0,7)}</Text>
       <Text type="supporting" color="secondary" className={styles.oneLine}>{first.message}</Text>
      </HStack>
     </Link>
    </VStack>
    {!!recorded.length&&<VStack as="ul" gap={0} className={styles.recordRows} aria-label={t('event.records')}>
     {recorded.slice(0,RECORDS_SHOWN).map(group=><RecordRow key={group.key} record={group.record!} events={group.events} features={features}/>)}
    </VStack>}
    {recorded.length>RECORDS_SHOWN&&<Link to="/records/commits/$commit" params={{commit:first.commit}} search={{tab:'records'}} className={styles.commitMore}>{t('activity.moreCommitRecords', { count: recorded.length-RECORDS_SHOWN })}</Link>}
    {bare&&<VStack gap={2} className={styles.reasonGroup}>
     {bare.missing&&<Text color="secondary">{t('activity.noRecord')}</Text>}
     <VStack as="ul" gap={0} className={styles.records} aria-label={t('commit.documents')}>
      {bare.events.map(event=><TimelineRecord key={event.key} event={event} features={features}/>)}
     </VStack>
    </VStack>}
    {hidden>0&&<Link to="/records/commits/$commit" params={{commit:first.commit}} search={{tab:'documents'}} className={styles.commitMore}>{t('activity.moreRecords', { count: hidden })}</Link>}
   </VStack>
  </HStack>
 </VStack>;
}, (before,after)=>before.day===after.day&&before.features===after.features
 &&before.hidden===after.hidden&&before.events.length===after.events.length&&before.events.every((event,index)=>event===after.events[index]));
