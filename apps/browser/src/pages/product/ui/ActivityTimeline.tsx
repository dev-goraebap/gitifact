import type { SpecEvent, SpecFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { groupCommits } from '../model/activity-groups';
import { TimelineCommit } from './TimelineCommit';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';

/**
 * Vertical timeline: one rail on the left, a marker where the date turns over, and one node per commit.
 * The commit is the entry, not the record. A reason is recorded against every record the commit changed, so a list
 * of records printed the same paragraph once per record — 209 times over this repository's 81 reasons. Here the
 * reason is written once and the records it explains sit under it.
 */
export function ActivityTimeline({events,features,selected,hidden}: {events:SpecEvent[];features:SpecFeature[];selected:SpecEvent|undefined;hidden?:Record<string,number>}) {
 return <VStack as="ol" aria-label={t('activity.list')} gap={0} className={styles.timeline}>
  {groupCommits(events).map(group=>
   <TimelineCommit key={group.commit} events={group.events} day={group.day} features={features} hidden={hidden?.[group.commit]??0}
    selected={selected&&group.events.some(e=>e.key===selected.key)?selected.key:undefined}/>)}
 </VStack>;
}
