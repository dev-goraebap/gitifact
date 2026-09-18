import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { DocumentBody } from '../../../shared/ui/document';
import { PageHeader } from '../../../widgets/page-header';
import { localDocument, t } from '../../../shared/i18n';
import logoUrl from '@gitifact/intro/assets/gitifact-logo.svg?url';
import styles from './about.module.css';

// The intro is shared with the README and the landing site and links to GitHub. Inside the browser, the requirements
// link opens the matching page instead.
const repository = 'https://github.com/dev-goraebap/gitifact';
const inAppLinks: [string, string][] = [
  ['](' + repository + '/tree/main/.gitifact/spec)', '](/features)'],
];
// The README opens with an HTML logo block, which Markdown here does not render; it becomes an image of the bundled file.
const logoBlock = /^<p align="center">\s*<img src="[^"]*" alt="([^"]*)"[^>]*\/>\s*<\/p>\s*/;
export function AboutPage() {
  const intro = localDocument('about').replace(logoBlock, (_block, alt: string) => '![' + alt + '](' + logoUrl + ')\n\n');
  const body = inAppLinks.reduce((text, [from, to]) => text.replaceAll(from, to), intro);
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: t('about.title') }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}><Heading level={1}>{t('about.title')}</Heading></VStack>
        <VStack as="article" aria-label={t('about.title')} gap={0} className={styles.body}><DocumentBody>{body}</DocumentBody></VStack>
      </VStack>
    </VStack>
  );
}
