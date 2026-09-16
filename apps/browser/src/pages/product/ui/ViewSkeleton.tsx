import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import styles from './product.module.css';

const rows = [0, 1, 2, 3, 4];
/** Placeholder shaped like the view it stands in for, so the swap to real data keeps the same layout. */
export function ViewSkeleton({ view }: { view: 'history' | 'features' | 'contributors' | 'product' | 'guides' }) {
  if (view === 'guides') return <HStack gap={0} role="status" aria-label="프로젝트 불러오는 중" aria-busy="true" className={`${styles.skeleton} ${styles.columns}`}>
    <VStack gap={2} className={styles.browserColumn} aria-hidden="true">{rows.map(i => <Skeleton key={i} index={i} width={`${60 + (i % 3) * 12}%`} height="var(--spacing-5)"/>)}</VStack>
    <VStack gap={0} className={styles.columnFiller} aria-hidden="true"/>
  </HStack>;
  if (view === 'product') return <VStack gap={6} role="status" aria-label="프로젝트 불러오는 중" aria-busy="true" className={`${styles.skeleton} ${styles.dashboard}`}>
    <VStack gap={2} className={styles.dashboardHead} aria-hidden="true"><Skeleton width="12rem" height="var(--spacing-8)"/><Skeleton width="20rem" height="var(--spacing-3)"/></VStack>
    <HStack gap={3} wrap="wrap" aria-hidden="true">{rows.map(i => <Skeleton key={i} index={i} width="9rem" height="5rem" radius={2}/>)}</HStack>
    <HStack gap={4} wrap="wrap" aria-hidden="true"><Skeleton width="20rem" height="16rem" radius={2}/><Skeleton width="20rem" height="16rem" radius={2}/></HStack>
  </VStack>;
  return <VStack gap={0} role="status" aria-label="프로젝트 불러오는 중" aria-busy="true" className={styles.skeleton}>
    <HStack gap={3} wrap="wrap" className={styles.filters} aria-hidden="true">
      <Skeleton width="11rem" height="var(--spacing-8)" radius={2}/>
      {view === 'history' && [0, 1, 2, 3].map(i => <Skeleton key={i} index={i} width="7rem" height="var(--spacing-8)" radius={2}/>)}
    </HStack>
    <VStack gap={0} padding={4} aria-hidden="true">
      {view === 'history' ? <VStack gap={0} className={styles.timeline}>
        {rows.map(i => <HStack key={i} gap={4} className={styles.entry}>
          <VStack gap={0} className={styles.entryAvatar}><Skeleton index={i} width="var(--spacing-6)" height="var(--spacing-6)" radius="rounded"/></VStack>
          <VStack gap={2} className={styles.entryBody}>
            <HStack gap={3} className={styles.entryHead}><Skeleton index={i} width="6rem" height="var(--spacing-4)"/><Skeleton index={i} width="3rem" height="var(--spacing-3)"/></HStack>
            <HStack gap={2}><Skeleton index={i} width="2.5rem" height="var(--spacing-5)" radius={2}/><Skeleton index={i} width={`${34 - i * 4}%`} height="var(--spacing-4)"/></HStack>
            <Skeleton index={i} width={`${46 + (i % 3) * 8}%`} height="var(--spacing-3)"/>
          </VStack>
        </HStack>)}
      </VStack> : <VStack gap={0}>
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
