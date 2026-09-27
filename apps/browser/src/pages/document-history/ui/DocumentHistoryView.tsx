import { useDeferredValue } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserCheckoutV1, BrowserSessionV3 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { documentHistoryOptions } from '../../../entities/project';
import { KindToken } from '../../../entities/document';
import { LoadMore } from '../../../shared/ui/load-more';
import { ApiError } from '../../../shared/api/client';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
import { currentLink } from '../model/current-link';
import { HistoryCommit } from './HistoryCommit';
import styles from './document-history.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The document named, where it is now, and how its history adds up; then each commit that changed it, newest first,
 * twenty at a time, the server picking them.
 */
export function DocumentHistoryView({ docId, session, checkout, head }: { docId: string; session: BrowserSessionV3; checkout: BrowserCheckoutV1; head: string }) {
  useLanguage();
  const query = useInfiniteQuery(documentHistoryOptions(session, head, docId));
  const pages = useDeferredValue(query.data)?.pages;
  if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') return <PageState kind="not-found" title={t('docHistory.notFoundTitle')}
    description={t('docHistory.notFoundDescription', { id: docId })} actions={<Link to="/records">{t('commit.backToList')}</Link>}/>;
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  const first = pages?.[0];
  if (!first || !pages) return <RequestState/>;
  const { doc } = first;
  const now = currentLink(checkout.index, docId);
  const events = pages.flatMap(page => page.events);
  return <VStack gap={0} as="article" aria-label={t('docHistory.title')} className={styles.page}>
    <Link to="/records" className={styles.back}>{t('commit.back')}</Link>
    <VStack gap={3} className={styles.heading}>
      <HStack gap={2} wrap="wrap" className={styles.title}>
        {doc.kind && <KindToken kind={doc.kind}/>}
        <Heading level={1}>{doc.title ?? docId}</Heading>
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Text type="supporting" color="secondary">{docId}</Text>
        {doc.path && <Text type="supporting" color="secondary">{doc.path}</Text>}
        {now ? <Link {...now} className={styles.current}>{t('docHistory.current')}</Link> : <Text type="supporting" color="secondary">{t('docHistory.gone')}</Text>}
      </HStack>
      <Text type="supporting" color="secondary">{t('docHistory.summary', { commits: first.total, recorded: first.recorded, missing: first.withoutRecord })}</Text>
    </VStack>
    <VStack as="ol" gap={0} className={styles.commits} aria-label={t('docHistory.commits')}>
      {events.map(event => <HistoryCommit key={event.key} event={event}/>)}
    </VStack>
    <HStack gap={0} className={styles.more}><LoadMore label={t('docHistory.more')} query={query}/></HStack>
  </VStack>;
}
