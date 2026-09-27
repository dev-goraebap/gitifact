import type { SpecEvent } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Banner } from '@astryxdesign/core/Banner';
import { Link } from '@tanstack/react-router';
import { ChangeBadge } from '../../../entities/document';
import { Person } from '../../../entities/contributor';
import { HistoryRecord } from './HistoryRecord';
import styles from './document-history.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * One commit that changed the document: its day, what happened to the document, the commit and who made it, a link to
 * the change on the commit page, then the records that explain it. A change other than adding the document with no
 * record says so.
 */
export function HistoryCommit({ event }: { event: SpecEvent }) {
  useLanguage();
  const missing = !event.records.length && event.types.some(type => type !== 'created');
  return <VStack as="li" gap={3} className={styles.commit}>
    <HStack gap={3} wrap="wrap" className={styles.commitLine}>
      <Text type="supporting" color="secondary" className={styles.day}>{event.date.slice(0, 10)}</Text>
      <ChangeBadge event={event}/>
      <Link to="/records/commits/$commit" params={{ commit: event.commit }} className={styles.hash}>{event.commit.slice(0, 7)}</Link>
      <Person name={event.author} email={event.email}/>
      <Text type="supporting" color="secondary" className={styles.message}>{event.message}</Text>
      <Link to="/records/commits/$commit" params={{ commit: event.commit }} search={{ tab: 'documents' }} hash={event.id} className={styles.compare}>{t('docHistory.compare')}</Link>
    </HStack>
    {event.records.map(record => <HistoryRecord key={record.id} record={record}/>)}
    {missing && <Banner status="warning" title={t('docHistory.noRecord')} container="card"/>}
  </VStack>;
}
