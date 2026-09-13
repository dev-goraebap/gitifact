import { useQuery } from '@tanstack/react-query';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { projectOptions, type BrowserSessionV1 } from '../../../entities/project';
import { ApiError } from '../../../shared/api/client';
import type { WorkspaceProps } from './WorkspacePage';
import { OverviewPanel } from './OverviewPanel';
import { RequirementsPanel } from './RequirementsPanel';
import { DecisionsPanel } from './DecisionsPanel';
import styles from './workspace.module.css';
const titles = {
  overview: ['브리핑', '제품의 요구사항과 남겨진 판단을 살펴보세요.'],
  requirements: ['요구사항', '무엇을 만들기로 했는지, 어떤 내용을 확인했는지.'],
  decisions: ['판단 기록', '개발 중 발견한 사실과 제약, 선택하지 않은 이유.'],
};
export function ProjectPanel({
  session,
  reconnect,
  ...props
}: WorkspaceProps & { session: BrowserSessionV1; reconnect: () => void }) {
  const query = useQuery(projectOptions(session));
  const invalid =
    query.error instanceof ApiError && ['SESSION_CHANGED', 'INVALID_RESPONSE'].includes(query.error.code);
  const data = invalid ? undefined : query.data;
  return (
    <VStack gap={0} width="100%" minHeight="100%" className={styles.page}>
      <VStack as="header" gap={2} padding={6} className={styles.header}>
        <Text type="supporting" color="secondary">
          WORKSPACE / {titles[props.view][0]}
        </Text>
        <HStack gap={4} wrap="wrap">
          <Heading level={1}>{titles[props.view][0]}</Heading>
          <Button
            size="sm"
            label={query.isFetching ? '읽는 중…' : '새로 읽기'}
            isDisabled={query.isFetching || invalid}
            onClick={() => {
              void query.refetch();
            }}
          />
        </HStack>
        <Text color="secondary">{titles[props.view][1]}</Text>
        {data?.brief.report && (
          <Text type="supporting" color="secondary">
            {data.brief.report.repository.rootPath} · 마지막 조회{' '}
            {new Date(data.brief.report.observation.completedAt).toLocaleString('ko-KR')}
          </Text>
        )}
      </VStack>
      {query.error && (
        <VStack padding={5} gap={2} role="alert">
          <Text>{query.error.message}</Text>
          {invalid ? (
            <Button label="다시 연결" onClick={reconnect} />
          ) : (
            data && <Text>이전 조회 결과입니다. 새로 읽기를 다시 시도하세요.</Text>
          )}
        </VStack>
      )}
      {!data && query.isPending && (
        <VStack padding={6} role="status">
          <Text>프로젝트 기록을 읽고 있습니다.</Text>
        </VStack>
      )}
      {data && (
        <>
          {!data.brief.ok && (
            <VStack padding={4} role="alert">
              <Text>일부 자료를 읽지 못했습니다: {data.brief.error.message}</Text>
            </VStack>
          )}
          {props.view === 'overview' && <OverviewPanel project={data} />}
          {props.view === 'requirements' && (
            <RequirementsPanel
              requirements={data.requirements}
              search={props.search}
              onSearch={props.onSearch}
            />
          )}
          {props.view === 'decisions' && (
            <DecisionsPanel
              notes={data.brief.report?.notes}
              search={props.search}
              onSearch={props.onSearch}
            />
          )}
        </>
      )}
    </VStack>
  );
}
