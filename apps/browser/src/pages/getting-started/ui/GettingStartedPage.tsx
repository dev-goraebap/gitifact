import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { DocumentBody } from '../../../shared/ui/document';
import { PageHeader } from '../../../widgets/page-header';
import { localDocument, t, useLanguage } from '../../../shared/i18n';
import styles from './getting-started.module.css';

export function GettingStartedPage() {
  useLanguage();
  const body = localDocument('gettingStarted').replace(/^# [^\n]+\n+/, '');
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: t('gettingStarted.title') }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>{t('gettingStarted.title')}</Heading></VStack>
        <VStack as="article" aria-label={t('gettingStarted.title')} gap={0} className={styles.body}><DocumentBody>{body}</DocumentBody></VStack>
      </VStack>
    </VStack>
  );
}
