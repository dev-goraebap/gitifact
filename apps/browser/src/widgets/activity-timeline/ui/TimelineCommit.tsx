import { memo } from 'react';
import type { SpecEvent, IndexFeature, HistoryCommitSize } from '@gitifact/contracts';
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

/**
 * `hidden` counts the commit's documents this list leaves out — the overview shows a few of a large commit. `whole` is
 * the commit as it is when a filter chose `events`: the card counts the commit, not the changes the filter kept.
 */
type Props = {events:SpecEvent[];day:string|undefined;features:IndexFeature[];hidden:number;whole?:HistoryCommitSize|undefined};
/** Records a commit lists before the rest are left to its page: a commit may add a hundred. */
const RECORDS_SHOWN = 3;
// Documents no record explains are cut like the documents under a record, and the rest are on the commit page.
const BARE_SHOWN = 3;

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
 * Filtered, a card shows the records that explain a change the filter is about; the commit's other records and a
 * record's other documents are counted and left to the commit's and the record's pages.
 * Its props are the event and feature objects the queries keep between renders and are compared by identity, so
 * "load more" draws the new commits and leaves the ones already on screen alone; before the list was grouped every
 * press drew the whole list again and took longer the more had been loaded.
 */
export const TimelineCommit = memo(function TimelineCommit({events,day,features,hidden,whole}: Props) {
  useLanguage();
 const first=events[0]!;
 const groups=groupRecords(events);
 const recorded=groups.filter(group=>group.record);
 const bare=groups.find(group=>!group.record);
 const shownBare=bare?Math.min(bare.events.length,BARE_SHOWN):0;
 // Documents the list leaves out: past the few shown without a record, and those the list did not load or the filter left.
 const moreDocuments=whole?whole.unrecorded-shownBare:(bare?bare.events.length-shownBare:0)+hidden;
 // Records of the commit that explain no change the filter is about.
 const otherRecords=whole?whole.records.filter(r=>!recorded.some(group=>group.ids.includes(r.id))).length:0;
 const records=recorded.length+otherRecords;
 const moreRecords=records-Math.min(recorded.length,RECORDS_SHOWN);
 const documents=whole?whole.documents:events.length+hidden;
 // What each record explains in the whole commit; a reason from before records is one per document it explained.
 const explains=(ids:string[])=>whole?whole.records.filter(r=>ids.includes(r.id)).reduce((sum,r)=>sum+r.documents,0):undefined;
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
       {!!records&&<Text type="supporting" color="secondary">{t('activity.commitRecords', { count: records })}</Text>}
       {documents>1&&<Text type="supporting" color="secondary">{t('activity.recordCount', { count: documents })}</Text>}
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
     {recorded.slice(0,RECORDS_SHOWN).map(group=><RecordRow key={group.key} record={group.record!} events={group.events} features={features} explains={explains(group.ids)}/>)}
    </VStack>}
    {moreRecords>0&&<Link to="/records/commits/$commit" params={{commit:first.commit}} search={{tab:'records'}} className={styles.commitMore}>
     {otherRecords?t('activity.otherRecords', { count: moreRecords }):t('activity.moreCommitRecords', { count: moreRecords })}</Link>}
    {bare&&<VStack gap={2} className={styles.reasonGroup}>
     {bare.missing&&<Text color="secondary">{t('activity.noRecord')}</Text>}
     <VStack as="ul" gap={0} className={styles.records} aria-label={t('commit.documents')}>
      {bare.events.slice(0,BARE_SHOWN).map(event=><TimelineRecord key={event.key} event={event} features={features}/>)}
     </VStack>
    </VStack>}
    {moreDocuments>0&&<Link to="/records/commits/$commit" params={{commit:first.commit}} search={{tab:'documents'}} className={styles.commitMore}>
     {whole&&!bare?t('activity.otherUnrecorded', { count: moreDocuments }):t('activity.moreRecords', { count: moreDocuments })}</Link>}
   </VStack>
  </HStack>
 </VStack>;
}, (before,after)=>before.day===after.day&&before.features===after.features
 &&before.hidden===after.hidden&&before.whole===after.whole&&before.events.length===after.events.length&&before.events.every((event,index)=>event===after.events[index]));
