import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@tanstack/react-router';
export function NotFoundPage() {
  return (
    <VStack padding={6} gap={4}>
      <Heading level={1}>페이지를 찾을 수 없습니다</Heading>
      <Link to="/">처음으로</Link>
    </VStack>
  );
}
