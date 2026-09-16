import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Banner } from '@astryxdesign/core/Banner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV1, RepositoryStatusSuccessV1 } from '@gitifact/contracts';
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

type Change = RepositoryStatusSuccessV1['changes'][number];
type State = { label: string; color: 'red' | 'green' | 'blue' | 'gray' };

/** Reads the two-letter porcelain code into the states a reader scans for; a path can be both staged and unstaged. */
function states(change: Change): State[] {
  if (change.kind === 'unmerged') return [{ label: '충돌', color: 'red' }];
  if (change.kind === 'untracked' || !change.xy) return [{ label: 'Untracked', color: 'gray' }];
  const out: State[] = [];
  if (change.xy[0] !== '.') out.push({ label: 'Staged', color: 'green' });
  if (change.xy[1] !== '.') out.push({ label: 'Unstaged', color: 'blue' });
  return out;
}

function submoduleNote(change: Change) {
  if (!change.submodule) return null;
  return [
    change.submodule.commitChanged && 'submodule 커밋 변경',
    change.submodule.trackedChanges && '내부 tracked 변경',
    change.submodule.untrackedChanges && '내부 untracked 변경',
  ].filter(Boolean).join(', ');
}

export function RepositoryPanel({ session, reconnect }: { session: BrowserSessionV1; reconnect: () => void }) {
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
    { key: 'xy', header: '상태', width: pixel(150), renderCell: (change) => <HStack gap={1} wrap="wrap">{states(change).map((s) => <Token key={s.label} label={s.label} color={s.color} size="sm" />)}</HStack> },
    { key: 'code', header: '코드', width: pixel(64), renderCell: (change) => <Text type="supporting" color="secondary" className={styles.code}>{change.xy ?? '??'}</Text> },
    { key: 'path', header: '경로', width: proportional(1, { minWidth: 160 }), renderCell: (change) => <Text className={styles.path}>{change.path}</Text> },
  ];
  if (hasSubmodule) columns.push({ key: 'submodule', header: '추가 정보', width: proportional(1), renderCell: (change) => <Text type="supporting" color="secondary">{submoduleNote(change) ?? '—'}</Text> });
  const summary = data ? [
    ['Staged', data.summary.staged], ['Unstaged', data.summary.unstaged], ['Untracked', data.summary.untracked], ['충돌', data.summary.conflicted],
  ] as const : [];
  return (
    <VStack gap={0} className={styles.page} aria-busy={busy}>
      <PageHeader trail={[{ label: 'Git 상태' }]} actions={<HStack gap={3} className={styles.headerActions}>
        {data && <Text type="supporting" color="secondary" className={styles.headerTime}><time dateTime={data.observation.completedAt}>{new Date(data.observation.completedAt).toLocaleString()}</time> 조회</Text>}
        <IconButton label={busy ? '조회 중…' : '상태 새로고침'} icon={<HgiRefresh />} variant="ghost" size="sm" isLoading={busy} isDisabled={busy || needsReconnect} onClick={() => refresh.mutate()} />
      </HStack>} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>Git 상태</Heading></VStack>
        <VStack gap={5} className={styles.content} aria-label="저장소 상태">
          {working && <Banner status="warning" container="card" collapsible={false} title="미커밋 명세 변경이 있습니다" description={<Text type="supporting">요구사항·제품 개요·지침 화면은 작업 중인 내용이고, 활동은 커밋된 내용입니다. 커밋은 에이전트에게 요청하세요. <Link to="/features">요구사항 보기 →</Link></Text>} />}
          {error && (
            <VStack role="alert" gap={3}>
              <Text>{error.message}</Text>
              {needsReconnect ? <HStack><Button label="다시 연결" onClick={reconnect} /></HStack> : data && <Text type="supporting" color="secondary">이전 조회 결과입니다. 상단의 조회 시각을 참고하세요.</Text>}
            </VStack>
          )}
          {!data && query.isPending && <Text role="status" type="supporting" color="secondary">저장소 상태를 읽고 있습니다.</Text>}
          {data && (
            <>
              <MetadataList columns="multi">
                <MetadataListItem label="브랜치">{data.head.branch ?? 'detached HEAD'}</MetadataListItem>
                <MetadataListItem label="HEAD">{data.head.commit ? <Text className={styles.code}>{data.head.commit.slice(0, 10)}</Text> : '아직 커밋이 없습니다'}</MetadataListItem>
                <MetadataListItem label="저장소"><Text className={styles.path}>{data.repository.rootPath}</Text></MetadataListItem>
              </MetadataList>
              <HStack gap={6} wrap="wrap" aria-label="변경 집계" className={styles.summary}>
                {summary.map(([label, count]) => <HStack key={label} gap={2} className={styles.summaryItem}><Text type="supporting" color="secondary">{label}</Text><Text weight="semibold">{count}</Text></HStack>)}
              </HStack>
              {data.changes.length === 0
                ? <PageState isCompact title="변경된 파일이 없습니다" description="작업 트리가 마지막 커밋과 같습니다." />
                : <VStack gap={3} className={styles.changes}>
                    <Text type="supporting" color="secondary">변경 경로 {data.changes.length}개 · 코드의 첫 글자는 staged, 두 번째는 unstaged이며 .은 변경 없음입니다.</Text>
                    <Table data={data.changes} idKey="path" columns={columns} density="compact" dividers="rows" textOverflow="wrap" />
                  </VStack>}
              <HStack gap={3} wrap="wrap">
                <Text type="supporting" color="secondary">관측한 Git 상태이며 파일 내용을 고정한 스냅샷은 아닙니다.</Text>
                <Text type="supporting" color="secondary">gitifact 요구사항 검사는 아직 실행하지 않습니다.</Text>
              </HStack>
            </>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}
