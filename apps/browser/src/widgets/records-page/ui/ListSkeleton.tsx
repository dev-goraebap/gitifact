import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import styles from './records.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const rows = [0, 1, 2, 3, 4];
/**
 * Placeholder for a list screen: the filter row (a search box and `selectors` selectors), then table rows, or the
 * body a screen brings (the activity brings its timeline).
 */
export function ListSkeleton({ selectors = 0, children }: { selectors?: number; children?: ReactNode }) {
  useLanguage();
  return <VStack gap={0} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={styles.skeleton}>
    <HStack gap={3} wrap="wrap" className={styles.filters} aria-hidden="true">
      <Skeleton width="11rem" height="var(--spacing-8)" radius={2}/>
      {Array.from({ length: selectors }, (_, i) => <Skeleton key={i} index={i} width="7rem" height="var(--spacing-8)" radius={2}/>)}
    </HStack>
    <VStack gap={0} padding={4} aria-hidden="true">
      {children ?? <VStack gap={0}>
        <HStack gap={4} className={styles.skeletonRow}><Skeleton width="5rem" height="var(--spacing-3)"/><Skeleton width="4rem" height="var(--spacing-3)"/><Skeleton width="4rem" height="var(--spacing-3)"/></HStack>
        {rows.map(i => <HStack key={i} gap={4} className={styles.skeletonRow}>
          <VStack gap={2} className={styles.entryBody}><Skeleton index={i} width={`${28 + (i % 3) * 10}%`} height="var(--spacing-4)"/><Skeleton index={i} width="40%" height="var(--spacing-3)"/></VStack>
          <Skeleton index={i} width="2rem" height="var(--spacing-4)"/>
          <Skeleton index={i} width="3rem" height="var(--spacing-5)" radius={2}/>
          <HStack gap={0}><Skeleton index={i} width="var(--spacing-6)" height="var(--spacing-6)" radius="rounded"/><Skeleton index={i} width="var(--spacing-6)" height="var(--spacing-6)" radius="rounded"/></HStack>
          <Skeleton index={i} width="3.5rem" height="var(--spacing-3)"/>
        </HStack>)}
      </VStack>}
    </VStack>
  </VStack>;
}
