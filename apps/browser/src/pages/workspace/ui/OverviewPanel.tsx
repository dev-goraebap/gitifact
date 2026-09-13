import { availabilityMessage } from '../model/availability';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Token } from '@astryxdesign/core/Token';
import { Link } from '@tanstack/react-router';
import type { BrowserProjectV1 } from '../../../entities/project';
import styles from './workspace.module.css';
export function OverviewPanel({ project }: { project: BrowserProjectV1 }) {
  const report = project.brief.report;
  const requirements = project.requirements.state === 'available' ? project.requirements.data : undefined;
  if (!report)
    return (
      <VStack padding={6}>
        <Text>프로젝트를 읽지 못했습니다. 새로 읽기를 시도하세요.</Text>
      </VStack>
    );
  return (
    <VStack padding={6} gap={6}>
      <VStack gap={3}>
        <Heading level={2}>현재 프로젝트</Heading>
        <HStack gap={3} wrap="wrap">
          <Token label={report.git.head.branch ?? 'detached HEAD'} color="default" />
          <Token
            label={
              report.project.state === 'available'
                ? report.project.data.mode === 'auto'
                  ? '자동모드'
                  : report.project.data.mode === 'approval'
                    ? '승인모드'
                    : report.project.data.mode
                : '설정 확인 필요'
            }
            color="blue"
          />
        </HStack>
        <Text color="secondary">
          관측한 작업 트리의 기록입니다. 구현 완료율과 전체 이력 검사는 아직 제공하지 않습니다.
        </Text>
        {report.project.state !== 'available' && (
          <Text>
            {report.project.state === 'error' ? report.project.error.message : availabilityMessage(report.project.reason)}
          </Text>
        )}
      </VStack>
      <VStack gap={3}>
        <Heading level={2}>요구사항 현황</Heading>
        {requirements ? (
          <HStack gap={6} wrap="wrap">
            <Link to="/requirements">전체 {requirements.length}</Link>
            <Link to="/requirements" search={{ state: 'draft' }}>
              초안 {requirements.filter((r) => r.state === 'draft').length}
            </Link>
            <Link to="/requirements" search={{ state: 'active' }}>
              확정 {requirements.filter((r) => r.state === 'active').length}
            </Link>
            <Link to="/requirements" search={{ state: 'approved' }}>
              사용자 승인 {requirements.filter((r) => r.approval === 'approved').length}
            </Link>
          </HStack>
        ) : (
          <Text>
            {project.requirements.state === 'error'
              ? project.requirements.error.message
              : project.requirements.state === 'not-available'
                ? availabilityMessage(project.requirements.reason)
                : ''}
          </Text>
        )}
        <Text type="supporting" color="secondary">
          확정은 구현 기준이 정해졌다는 뜻입니다. 구현·검증 완료를 의미하지 않습니다.
        </Text>
      </VStack>
      <VStack gap={3}>
        <Heading level={2}>최근 판단</Heading>
        {report.notes.state === 'available' ? (
          <>
            {report.notes.data.items.slice(0, 4).map((note) => (
              <VStack key={note.id} gap={2} padding={3} className={styles.row}>
                <HStack gap={3}>
                  <Token
                    size="sm"
                    label={{ discovery: '발견', constraint: '제약', rejected: '기각' }[note.type]}
                  />
                  <Text type="supporting" color="secondary">
                    {note.recordedAt.slice(0, 10)} · {note.author ?? '작성자 미상'}
                  </Text>
                </HStack>
                <Text maxLines={2}>{note.text}</Text>
              </VStack>
            ))}
            {report.notes.data.total === 0 && <Text>아직 판단 기록이 없습니다.</Text>}
            <Link to="/decisions">판단 기록 모두 보기</Link>
          </>
        ) : (
          <Text>{report.notes.state === 'error' ? report.notes.error.message : availabilityMessage(report.notes.reason)}</Text>
        )}
      </VStack>
    </VStack>
  );
}
