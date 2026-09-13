import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
export function AboutPage() {
  return (
    <VStack padding={6} gap={5} maxWidth="48rem">
      <Heading level={1}>tryce 소개</Heading>
      <Text>tryce는 에이전트와 함께 만드는 프로젝트의 요구사항과 결정 이력을 Git에 남기는 도구입니다.</Text>
      <Text>
        사용자는 제품에 집중하고, 에이전트는 대화에서 요구사항과 판단을 정리합니다. 이 화면에서 같은 기록을
        읽고 변경의 맥락을 살펴보세요.
      </Text>
      <Text color="secondary">
        현재는 요구사항·확인 이력·판단 기록과 Git 상태를 읽습니다. 전체 커밋 연결, 검사 결과, 스킬 탐색은 이후
        범위입니다.
      </Text>
    </VStack>
  );
}
