import { VStack } from '@astryxdesign/core/VStack';
import { PageState } from '../../../shared/ui/page-state';
import { Link } from '@tanstack/react-router';
import { t } from '../../../shared/i18n';
export function NotFoundPage() {
  return (
    <VStack padding={6} gap={4}>
      <PageState kind="not-found" title={t('notFound.title')} headingLevel={1} description={t('notFound.description')} actions={<Link to="/">{t('notFound.home')}</Link>}/>
    </VStack>
  );
}
