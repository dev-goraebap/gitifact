import { Button } from '@astryxdesign/core/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV1 } from '@tryce/contracts';
import { ApiError } from '../../../shared/api/client';
import { refreshStatus, statusKey, statusOptions } from '../api/repository';
import styles from './repository.module.css';

export function RepositoryPanel({ session, reconnect }: { session: BrowserSessionV1; reconnect: () => void }) {
  const client = useQueryClient();
  const query = useQuery(statusOptions(session));
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
  return (
    <section aria-label="저장소 상태" aria-busy={busy}>
      <div className={styles.toolbar}>
        <h2>Git 상태</h2>
        <Button label={busy ? '조회 중…' : '상태 새로고침'} variant="primary"
          isDisabled={busy || needsReconnect} onClick={() => refresh.mutate()} />
      </div>
      <p className={styles.notice}>tryce 요구사항 검사는 아직 실행하지 않습니다.</p>
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error.message}</p>
          {needsReconnect
            ? <Button label="다시 연결" onClick={reconnect} />
            : data && <p>이전 조회 결과입니다. 마지막 확인 시각을 참고하세요.</p>}
        </div>
      )}
      {!data && query.isPending && <p role="status">저장소 상태를 읽고 있습니다.</p>}
      {data && <>
        <dl className={styles.details}>
          <div><dt>저장소</dt><dd>{data.repository.rootPath}</dd></div>
          <div><dt>브랜치</dt><dd>{data.head.branch ?? 'detached HEAD'}</dd></div>
          <div><dt>HEAD</dt><dd>{data.head.commit ?? '아직 커밋이 없습니다'}</dd></div>
          <div><dt>마지막 확인</dt><dd><time dateTime={data.observation.completedAt}>{data.observation.completedAt}</time></dd></div>
        </dl>
        <p>관측한 Git 상태이며 파일 내용을 고정한 스냅샷은 아닙니다.</p>
        <dl className={styles.summary} aria-label="변경 집계">
          <div><dt>Staged</dt><dd>{data.summary.staged}</dd></div>
          <div><dt>Unstaged</dt><dd>{data.summary.unstaged}</dd></div>
          <div><dt>Untracked</dt><dd>{data.summary.untracked}</dd></div>
          <div><dt>충돌</dt><dd>{data.summary.conflicted}</dd></div>
        </dl>
        {data.changes.length === 0 ? <p>Git 변경 경로가 없습니다. tryce 검사는 미실행입니다.</p> : (
          <div className={styles.tableScroll}>
            <table>
              <caption>변경 경로 {data.changes.length}개</caption>
              <thead><tr><th scope="col">상태</th><th scope="col">경로</th><th scope="col">추가 정보</th></tr></thead>
              <tbody>{data.changes.map((change) => <tr key={change.path}>
                <td>{change.kind === 'unmerged' ? '충돌 ' : ''}{change.xy ?? '??'}</td>
                <td className={styles.path}>{change.path}</td>
                <td>{change.submodule ? [
                  change.submodule.commitChanged && 'submodule 커밋 변경',
                  change.submodule.trackedChanges && '내부 tracked 변경',
                  change.submodule.untrackedChanges && '내부 untracked 변경',
                ].filter(Boolean).join(', ') : '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        <p className={styles.legend}>상태의 첫 글자는 staged, 두 번째는 unstaged입니다. .은 변경 없음, ??는 untracked입니다.</p>
      </>}
    </section>
  );
}
