import { VStack } from '@astryxdesign/core/VStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';

/** Lines shaped like a commit or record page's text while the commit is read. */
export function CommitSkeleton({ label }: { label: string }) {
  return <VStack gap={4} role="status" aria-label={label}>{[40, 90, 70, 96, 84].map((w, i) => <Skeleton key={i} index={i} width={`${w}%`} height="var(--spacing-5)"/>)}</VStack>;
}
