import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Markdown } from '@astryxdesign/core/Markdown';
import { PageHeader } from '../../../widgets/page-header';
import { localDocument, t } from '../../../shared/i18n';
import styles from './about.module.css';

// The body mirrors the README of the gitifact repository; repository-relative links point at the browser pages or GitHub instead.
export function AboutPage() {
  const body = localDocument('about');
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: t('about.title') }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>{t('about.title')}</Heading></VStack>
        <VStack as="article" aria-label={t('about.title')} gap={0} className={styles.body}><Markdown headingLevelStart={2}>{body}</Markdown></VStack>
      </VStack>
    </VStack>
  );
}
