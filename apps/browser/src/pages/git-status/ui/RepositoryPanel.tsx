import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Banner } from '@astryxdesign/core/Banner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3, RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { Link } from '@tanstack/react-router';
import { ApiError } from '../../../shared/api/client';
import { refreshStatus, statusKey, statusOptions, useWorkingChanges } from '../../../entities/project';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Table, proportional, pixel, type TableColumn } from '@astryxdesign/core/Table';
import { PageHeader } from '../../../widgets/page-header';
import { PageState } from '../../../shared/ui/page-state';
import { HgiRefresh } from '../../../shared/ui/icons/HgiRefresh';
import styles from './git-status.module.css';
import { t, tNodes, useLanguage, getLanguage } from '../../../shared/i18n';

type Change = RepositoryStatusSuccessV1['changes'][number];
type State = { label: string; color: 'red' | 'green' | 'blue' | 'gray' };

/** Reads the two-letter porcelain code into the states a reader scans for; a path can be both staged and unstaged. */
function states(change: Change): State[] {
  if (change.kind === 'unmerged') return [{ label: t('git.conflict'), color: 'red' }];
  if (change.kind === 'untracked' || !change.xy) return [{ label: 'Untracked', color: 'gray' }];
  const out: State[] = [];
  if (change.xy[0] !== '.') out.push({ label: 'Staged', color: 'green' });
  if (change.xy[1] !== '.') out.push({ label: 'Unstaged', color: 'blue' });
  return out;
}

function submoduleNote(change: Change) {
  if (!change.submodule) return null;
  return [
    change.submodule.commitChanged && t('git.submoduleCommit'),
    change.submodule.trackedChanges && t('git.submoduleTracked'),
    change.submodule.untrackedChanges && t('git.submoduleUntracked'),
  ].filter(Boolean).join(', ');
}

export function RepositoryPanel({ session, reconnect }: { session: BrowserSessionV3; reconnect: () => void }) {
  useLanguage();
  const client = useQueryClient();
  const query = useQuery(statusOptions(session));
  const working = useWorkingChanges();
  const refresh = useMutation({
    mutationFn: () => refreshStatus(session),
    retry: false,
    onMutate: async () => { await client.cancelQueries({ queryKey: statusKey(session) }); },
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: statusKey(session) });
      await client.invalidateQueries({ queryKey: statusKey(session) });
    },
  });
  const error = refresh.error ?? query.error;
  const needsReconnect = error instanceof ApiError && (error.code === 'SESSION_CHANGED' || error.code === 'INVALID_RESPONSE');
  const data = needsReconnect ? undefined : query.data;
  const busy = refresh.isPending || query.isFetching;
  const hasSubmodule = !!data?.changes.some((change) => change.submodule);
  const columns: TableColumn<Change>[] = [
    { key: 'xy', header: t('git.column.state'), width: pixel(150), renderCell: (change) => <HStack gap={1} wrap="wrap">{states(change).map((s) => <Token key={s.label} label={s.label} color={s.color} size="sm" />)}</HStack> },
    { key: 'code', header: t('git.column.code'), width: pixel(64), renderCell: (change) => <Text type="supporting" color="secondary" className={styles.code}>{change.xy ?? '??'}</Text> },
    { key: 'path', header: t('git.column.path'), width: proportional(1, { minWidth: 160 }), renderCell: (change) => <Text className={styles.path}>{change.path}</Text> },
  ];
  if (hasSubmodule) columns.push({ key: 'submodule', header: t('git.column.extra'), width: proportional(1), renderCell: (change) => <Text type="supporting" color="secondary">{submoduleNote(change) ?? '—'}</Text> });
  const summary = data ? [
    ['Staged', data.summary.staged], ['Unstaged', data.summary.unstaged], ['Untracked', data.summary.untracked], [t('git.conflict'), data.summary.conflicted],
  ] as const : [];
  return (
    <VStack gap={0} className={styles.page} aria-busy={busy}>
      <PageHeader trail={[{ label: t('nav.git') }]} actions={<HStack gap={3} className={styles.headerActions}>
        {data && <Text type="supporting" color="secondary" className={styles.headerTime}>{tNodes('header.observedAt', { time: <time dateTime={data.observation.completedAt}>{new Date(data.observation.completedAt).toLocaleString(getLanguage())}</time> })}</Text>}
        <IconButton label={busy ? t('git.refreshing') : t('git.refresh')} icon={<HgiRefresh />} variant="ghost" size="sm" isLoading={busy} isDisabled={busy || needsReconnect} onClick={() => refresh.mutate()} />
      </HStack>} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>{t('nav.git')}</Heading></VStack>
        <VStack gap={5} className={styles.content} aria-label={t('git.repositoryState')}>
          {working && <Banner status="warning" container="card" collapsible={false} title={t('git.workingTitle')} description={<Text type="supporting">{t('git.workingNotice')} <Link to="/features">{t('git.viewRequirements')}</Link></Text>} />}
          {error && (
            <VStack role="alert" gap={3}>
              <Text>{error.message}</Text>
              {needsReconnect ? <HStack><Button label={t('common.reconnect')} onClick={reconnect} /></HStack> : data && <Text type="supporting" color="secondary">{t('git.previousResult')}</Text>}
            </VStack>
          )}
          {!data && query.isPending && <Text role="status" type="supporting" color="secondary">{t('git.reading')}</Text>}
          {data && (
            <>
              <MetadataList columns="multi">
                <MetadataListItem label={t('git.branch')}>{data.head.branch ?? 'detached HEAD'}</MetadataListItem>
                <MetadataListItem label="HEAD">{data.head.commit ? <Text className={styles.code}>{data.head.commit.slice(0, 10)}</Text> : t('git.noCommits')}</MetadataListItem>
                <MetadataListItem label={t('git.repository')}><Text className={styles.path}>{data.repository.rootPath}</Text></MetadataListItem>
              </MetadataList>
              <HStack gap={6} wrap="wrap" aria-label={t('git.summary')} className={styles.summary}>
                {summary.map(([label, count]) => <HStack key={label} gap={2} className={styles.summaryItem}><Text type="supporting" color="secondary">{label}</Text><Text weight="semibold">{count}</Text></HStack>)}
              </HStack>
              {data.changes.length === 0
                ? <PageState isCompact title={t('git.cleanTitle')} description={t('git.cleanDescription')} />
                : <VStack gap={3} className={styles.changes}>
                    <Text type="supporting" color="secondary">{t('git.changeSummary', { count: data.changes.length })}</Text>
                    <Table data={data.changes} idKey="path" columns={columns} density="compact" dividers="rows" textOverflow="wrap" />
                  </VStack>}
              <HStack gap={3} wrap="wrap">
                <Text type="supporting" color="secondary">{t('git.observedNote')}</Text>
                <Text type="supporting" color="secondary">{t('git.checksNote')}</Text>
              </HStack>
            </>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}
