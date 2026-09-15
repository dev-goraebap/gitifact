import { VStack } from '@astryxdesign/core/VStack';
import { PageState } from '../../../shared/ui/page-state';
import { Link } from '@tanstack/react-router';
export function NotFoundPage() {
  return (
    <VStack padding={6} gap={4}>
      <PageState kind="not-found" title="페이지를 찾을 수 없습니다" headingLevel={1} description="주소를 확인하거나 활동으로 돌아가세요." actions={<Link to="/">처음으로</Link>}/>
    </VStack>
  );
}
