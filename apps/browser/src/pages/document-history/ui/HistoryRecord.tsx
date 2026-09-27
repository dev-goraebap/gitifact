import { useId, useState } from 'react';
import type { SpecRecord } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Link } from '@tanstack/react-router';
import { decisionPreview, sectionLabel } from '../../../widgets/activity-timeline';
import { DocumentBody } from '../../../shared/ui/document';
import styles from './document-history.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * A record under the commit it came with: its title linking to its page and the first line of its decision; opened in
 * place, every section in full. Each record of a commit opens on its own. The toggle is a small ghost Button, whose icon
 * and label share one line box at the size of the text around it.
 */
export function HistoryRecord({ record }: { record: SpecRecord }) {
  useLanguage();
  const [isOpen, setOpen] = useState(false);
  const sections = useId();
  return <VStack gap={1} className={styles.record}>
    <Link to="/records/$recordId" params={{ recordId: record.id }} className={styles.recordTitle}>
      <Text type="supporting" color="secondary" className={styles.recordId}>{record.id}</Text> {record.title}
    </Link>
    {!isOpen && <Text type="supporting" color="secondary" className={styles.preview}>{decisionPreview(record)}</Text>}
    <HStack gap={0}>
      <Button variant="ghost" size="sm" icon={<Icon icon={isOpen ? 'chevronDown' : 'chevronRight'} size="sm"/>}
        label={isOpen ? t('docHistory.close') : t('docHistory.open')} aria-expanded={isOpen} aria-controls={sections} onClick={() => setOpen(open => !open)}/>
    </HStack>
    {isOpen && <VStack id={sections} gap={3} className={styles.sections}>
      {record.sections.map(section => <VStack as="section" key={section.key} gap={1} aria-label={sectionLabel[section.key]()}>
        <Text type="label">{sectionLabel[section.key]()}</Text>
        <DocumentBody headingLevelStart={4}>{section.body}</DocumentBody>
      </VStack>)}
    </VStack>}
  </VStack>;
}
