import { useEffect, useRef } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Button } from '@astryxdesign/core/Button';
import type { BrowserRequirementV1 } from '../../../entities/project';
import styles from './workspace.module.css';
export function RequirementDetail({
  requirement: r,
  onClose,
}: {
  requirement: BrowserRequirementV1;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, [r.id]);
  return (
    <VStack
      as="aside"
      ref={panel}
      tabIndex={-1}
      aria-label="요구사항 상세"
      padding={5}
      gap={5}
      className={styles.detail}
    >
      <HStack gap={3} wrap="wrap">
        <Text type="supporting">{r.spec} / 상세</Text>
        <Button size="sm" label="상세 닫기" onClick={onClose} />
      </HStack>
      <VStack gap={2}>
        <Heading level={2}>{r.title}</Heading>
        <Text type="supporting" color="secondary">
          {r.id}
        </Text>
        <Text type="supporting">구현 미평가 · 검증 미실행</Text>
      </VStack>
      <Markdown headingLevelStart={3} density="compact" className={styles.markdown}>
        {r.text}
      </Markdown>
      <VStack gap={3}>
        <Heading level={3}>수정 이력</Heading>
        {[...r.revisions].reverse().map((revision) => (
          <details key={revision.id}>
            <summary>
              {revision.title} · {revision.at.slice(0, 10)}
            </summary>
            <VStack gap={2} padding={3}>
              <Text type="supporting">
                {revision.id} · {revision.author}
              </Text>
              <Text>{revision.reason}</Text>
              <Markdown headingLevelStart={4} density="compact">
                {revision.text}
              </Markdown>
            </VStack>
          </details>
        ))}
      </VStack>
      <VStack gap={3}>
        <Heading level={3}>확인 기록</Heading>
        {r.decisions.length === 0 && <Text color="secondary">확정·승인 기록이 없습니다.</Text>}
        {[...r.decisions].reverse().map((decision, index) => {
          const review = r.reviews.find((item) => item.id === decision.review);
          const item = review?.items.find((item) => item.id === r.id);
          return (
            <VStack gap={2} key={decision.review + ':' + index} className={styles.row} padding={2}>
              <Text weight="semibold">
                {decision.kind === 'auto' ? '자동 확정' : '사용자 승인'} · {decision.actor}
              </Text>
              <Text type="supporting" color="secondary">
                {decision.at} · {decision.mode}
              </Text>
              <Text>{decision.evidence}</Text>
              {item && (
                <details>
                  <summary>확인한 정확한 내용</summary>
                  <VStack gap={2} padding={2}>
                    <Text type="supporting">수정본 {item.revision}</Text>
                    <Markdown headingLevelStart={4} density="compact">
                      {item.document}
                    </Markdown>
                  </VStack>
                </details>
              )}
            </VStack>
          );
        })}
      </VStack>
      <Text type="supporting" color="secondary">
        {r.path}
      </Text>
    </VStack>
  );
}
