import { useInfiniteQuery } from '@tanstack/react-query';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { List, ListItem } from '@astryxdesign/core/List';
import { Link } from '@tanstack/react-router';
import { historyOptions } from '../../../entities/project';
import styles from './product.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Shown beside a document: its newest changes. The rest are one link away in the activity. */
const SHOWN = 5;
const colors = { created: 'green', modified: 'blue', deleted: 'red', moved: 'purple' } as const;
const names = () => ({ created: t('change.created'), modified: t('change.modified'), deleted: t('change.deleted'), moved: t('change.moved') });

/**
 * The changes of one document, newest first, as `docs history` lists them: why it changed (the first reason, or the
 * commit title when none was recorded), how, when and by whom. Each opens that change in the activity.
 */
export function DocumentHistory({ session, head, id, featureId }: { session: BrowserSessionV3; head: string | null; id: string; featureId: string }) {
  useLanguage();
  const query = useInfiniteQuery({ ...historyOptions(session, head ?? '', { id }, SHOWN), enabled: !!head });
  const page = query.data?.pages[0];
  return <VStack as="section" gap={2} aria-label={t('document.history')} className={styles.documentHistory}>
    <Text type="supporting" color="secondary">{t('document.history')}</Text>
    {!head || page?.total === 0 ? <Text type="supporting" color="secondary">{t('document.historyNone')}</Text>
      : query.isError ? <Text type="supporting" color="secondary">{t('document.historyFailed')}</Text>
      : !page ? <Text type="supporting" color="secondary">{t('document.historyLoading')}</Text>
      : <List density="compact">
        {page.events.map(e => {
          const kind = e.types.includes('deleted') ? 'deleted' : e.types.includes('modified') ? 'modified' : e.types.includes('moved') ? 'moved' : 'created';
          return <ListItem key={e.key}
            label={<Link to="/activity" search={{ selected: e.key }} className={styles.oneLine}>{e.reasons[0] ?? e.message}</Link>}
            description={<HStack gap={2} wrap="wrap" className={styles.entryLine}>
              <Token label={e.types.map(type => names()[type]).join(' · ')} color={colors[kind]} size="sm"/>
              <Timestamp value={e.date} format="relative"/>
              <Text type="supporting" color="secondary">{e.author}</Text>
              <Text type="supporting" color="secondary">{e.commit.slice(0, 7)}</Text>
            </HStack>}/>;
        })}
      </List>}
    {page && page.total > page.events.length && <Link to="/activity" search={{ feature: featureId, q: id }}>{t('document.historyAll', { count: page.total })}</Link>}
  </VStack>;
}
