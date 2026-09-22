import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { TimelineSkeleton } from '../../../widgets/activity-timeline';
import styles from './overview.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Placeholder shaped like the overview, so the swap to real data keeps the same layout. */
export function OverviewSkeleton() {
  useLanguage();
  // The overview: the project and its size, the two charts, then the reasons. It borrows the page's own spacing
  // classes, nested the way the page nests them — the content padding outside, the dashboard inside — so the
  // placeholder sits exactly where the content will instead of drifting when the page is rearranged.
  return <VStack gap={6} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={styles.content}>
    <VStack gap={6} className={`${styles.skeleton} ${styles.dashboard}`}>
    <HStack gap={5} wrap="wrap" className={styles.hero} aria-hidden="true">
      <VStack gap={3} className={styles.heroText}>
        <Skeleton width="13rem" height="2.5rem"/>
        <Skeleton width="21rem" height="var(--spacing-5)"/>
        <Skeleton width="11rem" height="var(--spacing-4)"/>
      </VStack>
      <VStack gap={2} className={styles.pulse}><Skeleton width="100%" height="2.75rem"/><Skeleton width="12rem" height="var(--spacing-3)"/></VStack>
    </HStack>
    <HStack gap={4} wrap="wrap" aria-hidden="true">
      <Skeleton width="calc(50% - var(--spacing-2))" height="9rem" radius={2}/>
      <Skeleton width="calc(50% - var(--spacing-2))" height="9rem" radius={2}/>
    </HStack>
    <VStack gap={4} className={styles.lead} aria-hidden="true">
      <Skeleton width="7rem" height="var(--spacing-7)"/>
      <TimelineSkeleton isPlain/>
    </VStack>
    </VStack>
  </VStack>;
}
