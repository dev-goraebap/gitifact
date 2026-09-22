import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import styles from './wiki.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const rows = [0, 1, 2, 3, 4];
// Depth and label width per tree row: two folders open with a few pages under them, as a small wiki looks.
const tree: [number, string][] = [[0, '4rem'], [0, '5rem'], [1, '7rem'], [1, '6rem'], [0, '4.5rem'], [1, '8rem'], [1, '5.5rem'], [1, '6.5rem'], [0, '5rem']];
/** Placeholder shaped like the explorer, so the swap to real data keeps the same layout. */
export function WikiSkeleton({ page = false }: { page?: boolean }) {
  useLanguage();
  // The tree on the left, then the path bar and the body on the right. A page (`/wiki/$id`) reads
  // as a heading, a line of facts and paragraphs; a folder (`/wiki`) as a bordered list of entries. Both use the
  // explorer's own classes so the tree and the pane keep their widths when the real content replaces them.
  return <HStack gap={0} role="status" aria-label={t('request.loadingProject')} aria-busy="true" className={`${styles.skeleton} ${styles.explorer}`}>
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
}
