import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Link } from '@tanstack/react-router';
import { workingOptions } from '../../../entities/project';
import styles from './activity.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Records the entry names before leaving the rest to its page. */
const RECORDS_SHOWN = 3;

/**
 * The work not committed yet, above the committed history: the records written for the next commit and how many
 * documents changed, which the CLI's `records list` also puts first. Nothing shows when the working tree matches HEAD.
 */
export function WorkingEntry({ session }: { session: BrowserSessionV3 }) {
  useLanguage();
  const query = useQuery(workingOptions(session));
  const data = query.data;
  if (!data || (!data.records.length && !data.changes.length)) return null;
  return <VStack as="section" aria-label={t('working.title')} gap={2} className={styles.workingEntry}>
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Link to="/records/working" className={styles.workingTitle}>{t('working.title')}</Link>
      <Text type="supporting" color="secondary">{t('working.summary', { records: data.records.length, documents: data.changes.length })}</Text>
      {!!data.withoutRecord.length && <Token label={t('working.withoutRecord', { count: data.withoutRecord.length })} color="yellow" size="sm"/>}
    </HStack>
    {!!data.records.length && <VStack as="ul" gap={1} className={styles.workingRecords}>
      {data.records.slice(0, RECORDS_SHOWN).map(record => <li key={record.id}>
        <Link to="/records/$recordId" params={{ recordId: record.id }}>{record.title}</Link>
      </li>)}
      {data.records.length > RECORDS_SHOWN && <li><Link to="/records/working" search={{ tab: 'records' }}>{t('working.moreRecords', { count: data.records.length - RECORDS_SHOWN })}</Link></li>}
    </VStack>}
  </VStack>;
}
