import type { SpecEvent, IndexFeature, SpecRecord } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { decisionPreview } from '../model/record-preview';
import { TimelineRecord } from './TimelineRecord';
import styles from './timeline.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Documents a record lists before the rest are left to its page: one record may sweep twenty. */
const DOCUMENTS_SHOWN = 3;

/**
 * One record in a list: its title, which opens the record's page, the first line of its decision, then the documents
 * it explains, a line each, up to three. The sections are read on the record's page; a list that printed them all
 * showed three records a screen and took a hundred-record commit twenty screens to pass.
 */
export function RecordRow({ record, events, features }: { record: SpecRecord; events: SpecEvent[]; features: IndexFeature[] }) {
  useLanguage();
  const preview = decisionPreview(record);
  return <VStack as="li" gap={1} className={styles.recordRow}>
    <Link to="/records/$recordId" params={{ recordId: record.id }} className={styles.recordName}>{record.title}</Link>
    {preview && <Text type="supporting" color="secondary" className={styles.recordRowPreview}>{preview}</Text>}
    <VStack as="ul" gap={0} className={styles.records} aria-label={t('activity.changedRecords')}>
      {events.slice(0, DOCUMENTS_SHOWN).map(event => <TimelineRecord key={event.key} event={event} features={features} record={record.id}/>)}
    </VStack>
    {events.length > DOCUMENTS_SHOWN && <Link to="/records/$recordId" params={{ recordId: record.id }} className={styles.commitMore}>
      {t('activity.moreRecords', { count: events.length - DOCUMENTS_SHOWN })}</Link>}
  </VStack>;
}
