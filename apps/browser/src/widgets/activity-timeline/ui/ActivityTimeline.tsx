import type { SpecEvent, IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { groupCommits } from '../model/activity-groups';
import { TimelineCommit } from './TimelineCommit';
import styles from './timeline.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * Vertical timeline: one rail on the left, a marker where the date turns over, and one node per commit who made it.
 * Under it each record is written once with the documents it explains beneath, rather than repeated under every
 * document it names — a reason repeated per document printed the same paragraph 209 times over 81 reasons here.
 */
export function ActivityTimeline({events,features,hidden}: {events:SpecEvent[];features:IndexFeature[];hidden?:Record<string,number>}) {
  useLanguage();
 return <VStack as="ol" aria-label={t('activity.list')} gap={0} className={styles.timeline}>
  {groupCommits(events).map(group=>
   <TimelineCommit key={group.commit} events={group.events} day={group.day} features={features} hidden={hidden?.[group.commit]??0}/>)}
 </VStack>;
}
