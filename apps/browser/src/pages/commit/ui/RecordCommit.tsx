import { useQuery } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@tanstack/react-router';
import { commitFilesOptions } from '../../../entities/project';
import styles from './commit.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * What the commit holds besides this record, as a line in the record's head: its other records and its source code,
 * each a tab of the commit page. A part the commit does not have is left out.
 */
export function RecordCommit({ session, commit, others }: { session: BrowserSessionV3; commit: string; others: number }) {
  useLanguage();
  const code = useQuery(commitFilesOptions(session, commit)).data?.total;
  if (!others && !code) return null;
  return <HStack gap={4} wrap="wrap" className={styles.recordCommitLinks}>
    {others > 0 && <Link to="/records/commits/$commit" params={{ commit }} search={{ tab: 'records' }}>{t('record.otherRecords', { count: others })}</Link>}
    {!!code && <Link to="/records/commits/$commit" params={{ commit }} search={{ tab: 'code' }}>{t('record.codeFiles', { count: code })}</Link>}
  </HStack>;
}
