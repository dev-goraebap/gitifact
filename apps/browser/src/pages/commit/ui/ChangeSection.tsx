import type { IndexFeature } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { ChangeBadge } from '../../../entities/document';
import { ChangeBody, type Change } from './ChangeBody';
import styles from './commit.module.css';
import { useLanguage } from '../../../shared/i18n';

/**
 * One changed document as a section of the commit page: what happened to it and its title, then its body. The
 * section's anchor is the document ID, so a link that names a document opens the page there.
 */
export function ChangeSection({ change, features, head, current }: { change: Change; features: IndexFeature[]; head: string | null; current: boolean }) {
  useLanguage();
  const spec = change.after ?? change.before;
  return <VStack id={change.event.id} as="section" gap={4} aria-label={spec?.title ?? change.event.id} className={styles.change}
    {...(current ? { 'aria-current': 'location' as const } : {})}>
    <HStack gap={2} wrap="wrap" className={styles.changeHead}>
      <ChangeBadge event={change.event}/>
      <Heading level={3}>{spec?.title ?? change.event.id}</Heading>
    </HStack>
    <ChangeBody change={change} features={features} head={head}/>
  </VStack>;
}
