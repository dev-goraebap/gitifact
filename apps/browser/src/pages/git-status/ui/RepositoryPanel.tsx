import { Button } from '@astryxdesign/core/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV1 } from '@gitifact/contracts';
import { ApiError } from '../../../shared/api/client';
import { refreshStatus, statusKey, statusOptions } from '../../../entities/project';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';

export function RepositoryPanel({
  session,
  reconnect,
}: {
  session: BrowserSessionV1;
  reconnect: () => void;
}) {
  const client = useQueryClient();
  const query = useQuery(statusOptions(session));
  const refresh = useMutation({
    mutationFn: () => refreshStatus(session),
    retry: false,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: statusKey(session) });
    },
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: statusKey(session) });
      await client.invalidateQueries({ queryKey: statusKey(session) });
    },
  });
  const error = refresh.error ?? query.error;
  const needsReconnect =
    error instanceof ApiError && (error.code === 'SESSION_CHANGED' || error.code === 'INVALID_RESPONSE');
  const data = needsReconnect ? undefined : query.data;
  const busy = refresh.isPending || query.isFetching;
  return (
    <VStack gap={5} aria-label="저장소 상태" aria-busy={busy}>
      <HStack gap={4} wrap="wrap">
        <Button
          label={busy ? '조회 중…' : '상태 새로고침'}
          variant="primary"
          isDisabled={busy || needsReconnect}
          onClick={() => refresh.mutate()}
        />
        <Text color="secondary">gitifact 요구사항 검사는 아직 실행하지 않습니다.</Text>
      </HStack>
      {error && (
        <VStack role="alert" gap={3}>
          <Text>{error.message}</Text>
          {needsReconnect ? (
            <Button label="다시 연결" onClick={reconnect} />
          ) : (
            data && <Text>이전 조회 결과입니다. 마지막 확인 시각을 참고하세요.</Text>
          )}
        </VStack>
      )}
      {!data && query.isPending && <Text role="status">저장소 상태를 읽고 있습니다.</Text>}
      {data && (
        <>
          <VStack gap={2}>
            <Text>저장소: {data.repository.rootPath}</Text>
            <Text>브랜치: {data.head.branch ?? 'detached HEAD'}</Text>
            <Text>HEAD: {data.head.commit ?? '아직 커밋이 없습니다'}</Text>
            <Text>
              마지막 확인: <time dateTime={data.observation.completedAt}>{data.observation.completedAt}</time>
            </Text>
          </VStack>
          <Text color="secondary">관측한 Git 상태이며 파일 내용을 고정한 스냅샷은 아닙니다.</Text>
          <HStack gap={5} wrap="wrap" aria-label="변경 집계">
            <Text>Staged {data.summary.staged}</Text>
            <Text>Unstaged {data.summary.unstaged}</Text>
            <Text>Untracked {data.summary.untracked}</Text>
            <Text>충돌 {data.summary.conflicted}</Text>
          </HStack>
          {data.changes.length === 0 ? (
            <Text>Git 변경 경로가 없습니다. gitifact 검사는 미실행입니다.</Text>
          ) : (
            <Table
              data={data.changes}
              idKey="path"
              density="compact"
              columns={[
                {
                  key: 'xy',
                  header: '상태',
                  width: pixel(90),
                  renderCell: (change) => (change.kind === 'unmerged' ? '충돌 ' : '') + (change.xy ?? '??'),
                },
                { key: 'path', header: '경로', width: proportional(3) },
                {
                  key: 'submodule',
                  header: '추가 정보',
                  width: proportional(1),
                  renderCell: (change) =>
                    change.submodule
                      ? [
                          change.submodule.commitChanged && 'submodule 커밋 변경',
                          change.submodule.trackedChanges && '내부 tracked 변경',
                          change.submodule.untrackedChanges && '내부 untracked 변경',
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : '—',
                },
              ]}
            />
          )}
          <Text type="supporting" color="secondary">
            상태의 첫 글자는 staged, 두 번째는 unstaged입니다. .은 변경 없음, ??는 untracked입니다.
          </Text>
        </>
      )}
    </VStack>
  );
}
