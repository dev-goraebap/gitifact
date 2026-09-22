import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import styles from './timeline.module.css';
import { t, useLanguage } from '../../../shared/i18n';

// How many records sit under each commit's reasons, as a few commits of a working day look.
const commits = [[3, 2], [4], [2, 2], [5]];
const overviewCommits = [[3, 2], [4], [2]];
/**
 * The activity timeline: the rail with an avatar per commit, then author and time, the reason, and its records.
 * The overview draws the same timeline inside its own status region, so there it stands in without one of its own.
 */
export function TimelineSkeleton({ isPlain = false }: { isPlain?: boolean } = {}) {
  useLanguage();
  const region = isPlain ? {} : { role: 'status', 'aria-label': t('request.loadingProject'), 'aria-busy': true } as const;
  return <VStack gap={0} className={styles.timeline} {...region}>
    {(isPlain ? overviewCommits : commits).map((reasons, i) => <HStack key={i} gap={4} className={`${styles.commit} ${styles.commitRow}`} aria-hidden="true">
      <VStack gap={0} className={styles.commitNode}><Skeleton index={i} width="var(--spacing-6)" height="var(--spacing-6)" radius="rounded"/></VStack>
      <VStack gap={5} className={styles.commitBody}>
        <VStack gap={1} className={styles.commitHead}>
          <HStack gap={3} className={styles.commitWho}><Skeleton index={i} width="6rem" height="var(--spacing-4)"/><Skeleton index={i} width="3rem" height="var(--spacing-3)"/></HStack>
          <HStack gap={2} className={styles.commitMeta}><Skeleton index={i} width="3.5rem" height="var(--spacing-3)"/><Skeleton index={i} width={`${38 - i * 4}%`} height="var(--spacing-3)"/></HStack>
        </VStack>
        {reasons.map((records, r) => <VStack key={r} gap={2} className={styles.reasonGroup}>
          <VStack gap={2} className={styles.reasonText}><Skeleton index={i} width="100%" height="var(--spacing-4)"/><Skeleton index={i} width={`${52 + r * 14}%`} height="var(--spacing-4)"/></VStack>
          <VStack gap={0} className={styles.records}>
            {Array.from({ length: records }, (_, n) => <HStack key={n} gap={2} className={styles.record}>
              <HStack gap={0} className={styles.recordType}><Skeleton index={n} width="2.75rem" height="var(--spacing-5)" radius={2}/></HStack>
              <Skeleton index={n} width="3.5rem" height="var(--spacing-3)"/>
              <Skeleton index={n} width={`${30 - n * 3}%`} height="var(--spacing-4)"/>
            </HStack>)}
          </VStack>
        </VStack>)}
      </VStack>
    </HStack>)}
  </VStack>;
}
