import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';

const rows = [0, 1, 2, 3, 4];
// Depth and label width per tree row: two folders open with a few pages under them, as a small wiki looks.
const tree: [number, string][] = [[0, '4rem'], [0, '5rem'], [1, '7rem'], [1, '6rem'], [0, '4.5rem'], [1, '8rem'], [1, '5.5rem'], [1, '6.5rem'], [0, '5rem']];
/** Placeholder shaped like the view it stands in for, so the swap to real data keeps the same layout. */
export function ViewSkeleton({ view, page = false }: { view: 'history' | 'features' | 'contributors' | 'product' | 'wiki'; page?: boolean }) {
  // The wiki explorer: the tree on the left, then the path bar and the body on the right. A page (`/wiki/$id`) reads
  // as a heading, a line of facts and paragraphs; a folder (`/wiki`) as a bordered list of entries. Both use the
  // explorer's own classes so the tree and the pane keep their widths when the real content replaces them.
  if (view === 'wiki') return <HStack gap={0} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={`${styles.skeleton} ${styles.explorer}`}>
    <VStack gap={0} className={styles.explorerTree} aria-hidden="true">
      {tree.map(([depth, width], i) => <HStack key={i} gap={2} className={styles.skeletonTreeRow} style={{ paddingInlineStart: `calc(var(--spacing-2) + ${depth} * var(--spacing-5))` }}>
        <Skeleton index={i} width="var(--spacing-4)" height="var(--spacing-4)" radius={1}/>
        <Skeleton index={i} width={width} height="var(--spacing-3)"/>
      </HStack>)}
    </VStack>
    <VStack gap={0} className={styles.explorerPane} aria-hidden="true">
      <div className={styles.explorerCrumbs}><Skeleton width={page ? '14rem' : '6rem'} height="var(--spacing-3)"/></div>
      {page
        ? <VStack gap={0} className={styles.explorerBody}>
          <VStack gap={3} className={styles.documentHeading}>
            <Skeleton width="55%" height="2.25rem"/>
            {/* Path, ID and last change: a label over a value each, then the link to the page's activity. */}
            <HStack gap={4} wrap="wrap">{['7.5rem', '6.5rem', '3rem'].map((w, i) => <VStack key={i} gap={2}><Skeleton index={i} width="2.5rem" height="var(--spacing-3)"/><Skeleton index={i} width={w} height="var(--spacing-3)"/></VStack>)}</HStack>
            <Skeleton width="6rem" height="var(--spacing-3)"/>
          </VStack>
          <VStack gap={3} className={styles.documentBody}>
            {[96, 88, 92, 61].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}
            <Skeleton width="30%" height="var(--spacing-5)"/>
            {[94, 83, 70].map((w, i) => <Skeleton key={'b' + i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}
          </VStack>
        </VStack>
        : <VStack gap={5} className={styles.explorerBody}>
          <VStack gap={0} className={styles.explorerList}>
            {rows.map(i => <HStack key={i} gap={3} className={styles.skeletonListRow}>
              <Skeleton index={i} width="var(--spacing-4)" height="var(--spacing-4)" radius={1}/>
              <VStack gap={1} className={styles.entryBody}><Skeleton index={i} width={`${10 + (i % 3) * 3}%`} height="var(--spacing-4)"/><Skeleton index={i} width={`${7 + (i % 2) * 3}%`} height="var(--spacing-3)"/></VStack>
            </HStack>)}
          </VStack>
          <VStack gap={3} className={styles.explorerReadme}>
            <Skeleton width="10rem" height="var(--spacing-5)"/>
            {[92, 86, 58].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-4)"/>)}
          </VStack>
        </VStack>}
    </VStack>
  </HStack>;
  // The overview: the project and its size, the two charts, then the reasons. It borrows the page's own spacing
  // classes, nested the way the page nests them — the content padding outside, the dashboard inside — so the
  // placeholder sits exactly where the content will instead of drifting when the page is rearranged.
  if (view === 'product') return <VStack gap={6} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={styles.content}>
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
      {[0, 1, 2].map(i => <VStack key={i} gap={3} className={styles.changeRow}>
        <Skeleton index={i} width="9rem" height="var(--spacing-5)"/>
        <Skeleton index={i} width={`${94 - i * 3}%`} height="var(--spacing-4)"/>
        <Skeleton index={i} width={`${64 - i * 6}%`} height="var(--spacing-4)"/>
        <HStack gap={3}><Skeleton index={i} width="13rem" height="var(--spacing-5)"/><Skeleton index={i} width="10rem" height="var(--spacing-5)"/></HStack>
      </VStack>)}
    </VStack>
    </VStack>
  </VStack>;
  return <VStack gap={0} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={styles.skeleton}>
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
