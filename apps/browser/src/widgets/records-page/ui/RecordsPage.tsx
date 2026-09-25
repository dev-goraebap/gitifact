import type { ComponentType, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3, BrowserSpecsV7 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HgiRefresh } from '../../../shared/ui/icons/HgiRefresh';
import { sessionOptions, specsOptions } from '../../../entities/project';
import { ApiError } from '../../../shared/api/client';
import styles from './records.module.css';
import { RequestState } from '../../../shared/ui/request-state';
import { useLoadingHold } from '../../../shared/ui/request-state/useLoadingHold';
import { t, tNodes, useLanguage, getLanguage } from '../../../shared/i18n';
import { DocumentIndexProvider } from '../../../shared/ui/document';
import { DescriptionHelp } from '../../../shared/ui/description-help';
import { StaleNotice, useBehind } from '../../../features/stale-notice';

export type Crumb = { label: string; to?: string };
export interface RecordsPageProps {
  /** The page header the screen uses; passed in so this widget does not reach into another. */
  header: ComponentType<{ trail: Crumb[]; actions?: ReactNode }>;
  /** The screen's name, first in the trail and its heading when `hasTitle`. */
  title: string;
  /** Short explanation shown from the list page title. */
  description?: string;
  /** Where the first crumb leads. */
  root: string;
  /** Crumbs after the screen's own once the checkout is read: the feature, the person or the page being shown. */
  trail?: (checkout: BrowserSpecsV7) => Crumb[];
  /** A list shows its name as a heading; detail pages and the overview carry their own. */
  hasTitle: boolean;
  /** A screen whose content is compared side by side (the commit page) gets a wider column than reading prose needs. */
  isWide?: boolean;
  /** The filter row under the heading, which stays in view while the list scrolls. */
  filters?: (checkout: BrowserSpecsV7) => ReactNode;
  /** Shaped like the screen, shown while the checkout is read. */
  skeleton: ReactNode;
  children: (context: { checkout: BrowserSpecsV7; session: BrowserSessionV3 }) => ReactNode;
}

/**
 * The frame every records screen shares: the session and the checkout read once, the header with the time of that
 * read and a refresh, the loading skeleton, the failure states, and the index documents resolve their links with.
 * Coming back to the tab asks whether the project changed since that read; when it did, a notice offers the refresh.
 * A new server session starts the frame over so nothing of another session's answers is shown.
 */
export function RecordsPage(props: RecordsPageProps) {
  const session = useQuery(sessionOptions());
  if (!session.data || session.error) return <RequestState error={session.error} retry={() => { void session.refetch(); }}/>;
  return <RecordsPanel key={session.data.sessionId} session={session.data} {...props}/>;
}

function RecordsPanel({ session, header: Header, title, description, root, trail, hasTitle, isWide = false, filters, skeleton, children }: RecordsPageProps & { session: BrowserSessionV3 }) {
  useLanguage();
  const query = useQuery(specsOptions(session));
  const client = useQueryClient();
  // A refresh reads the checkout again and forgets the uncommitted work, which is worked out anew when shown.
  const refresh = () => { void query.refetch(); void client.invalidateQueries({ predicate: q => q.queryKey[0] === 'browser-working' || q.queryKey[0] === 'browser-working-change' }); };
  // When the checkout was last answered, which changes with every read even when the answer is the same.
  const behind = useBehind(session, query.data?.stamp, query.dataUpdatedAt);
  const disconnected = query.error instanceof ApiError && query.error.code === 'SESSION_CHANGED';
  const first = disconnected ? undefined : query.data;
  // The skeleton waits 200ms before appearing and then stays at least 300ms, so fast answers never flash and slow ones never blink.
  const loading = useLoadingHold(!first && !query.error);
  const ready = !!first && !loading;
  const crumbs = [{ label: title, to: root }, ...(first && trail ? trail(first) : [])];
  const actions = <HStack gap={3} className={styles.headerActions}>
    {first && <Text type="supporting" color="secondary" className={styles.headerTime}>{tNodes('header.observedAt', { time: <time dateTime={first.observedAt}>{new Date(first.observedAt).toLocaleString(getLanguage())}</time> })}</Text>}
    <IconButton label={t('common.refresh')} icon={<HgiRefresh/>} variant="ghost" size="sm" isLoading={query.isFetching} isDisabled={query.isFetching} onClick={refresh}/>
  </HStack>;
  return <VStack gap={0} className={styles.page}>
    <Header trail={crumbs} actions={actions}/>
    <VStack gap={0} className={isWide ? `${styles.column} ${styles.wide}` : styles.column}>
      {hasTitle && <HStack gap={2} vAlign="center" className={styles.pageTitle}><Heading level={1}>{title}</Heading>{description && <DescriptionHelp title={title} description={description}/>}</HStack>}
      {behind && first && <VStack gap={0} className={styles.staleNotice}><StaleNotice isRefreshing={query.isFetching} onRefresh={refresh}/></VStack>}
      {query.error && first && <VStack padding={4} role="alert"><Text>{query.error.message}</Text><Text>{t('history.staleData')}</Text></VStack>}
      {!first && query.error && <RequestState error={query.error} retry={() => { if (disconnected) window.location.reload(); else void query.refetch(); }}/>}
      {loading && skeleton}
      {ready && filters && <HStack gap={3} wrap="wrap" className={`${styles.filters} ${styles.filtersSticky}`}>{filters(first)}</HStack>}
      {ready && <VStack gap={3} className={styles.content}>
        <DocumentIndexProvider index={first}>{children({ checkout: first, session })}</DocumentIndexProvider>
        {first.contributorsLimited && <HStack gap={3} wrap="wrap"><Text type="supporting">{t('history.contributorsLimited')}</Text></HStack>}
      </VStack>}
    </VStack>
  </VStack>;
}
