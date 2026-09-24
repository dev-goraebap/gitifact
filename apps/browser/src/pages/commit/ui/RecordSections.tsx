import type { SpecRecord } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { sectionLabel } from '../../../widgets/activity-timeline';
import styles from './commit.module.css';
import { DocumentBody } from '../../../shared/ui/document';
import { useLanguage } from '../../../shared/i18n';

/**
 * A record's sections as the body of its page, each headed in the reader's language whatever language its heading was
 * written in, and read as Markdown at a reading width.
 */
export function RecordSections({ record }: { record: SpecRecord }) {
  useLanguage();
  return <VStack gap={6} className={styles.recordSections}>
    {record.sections.map(section => <VStack as="section" key={section.key} gap={2} aria-label={sectionLabel[section.key]()}>
      <Heading level={2}>{sectionLabel[section.key]()}</Heading>
      <DocumentBody headingLevelStart={3}>{section.body}</DocumentBody>
    </VStack>)}
  </VStack>;
}
