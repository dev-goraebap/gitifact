import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Markdown } from '@astryxdesign/core/Markdown';
import { useQuery } from '@tanstack/react-query';
import { changelogOptions, sessionOptions } from '../../../entities/project';
import type { BrowserSessionV2 } from '../../../entities/project';
import { PageHeader } from '../../../widgets/page-header';
import { RequestState } from '../../../shared/ui/request-state';
import { PageState } from '../../../shared/ui/page-state';
import { defaultLanguage, t } from '../../../shared/i18n';
import styles from './changelog.module.css';

// Section keys are language-independent tokens from the notes file; only their labels are translated here.
const sections = [
  ['added', t('changelog.added'), 'green'],
  ['changed', t('changelog.changed'), 'blue'],
  ['removed', t('changelog.removed'), 'red'],
  ['fixed', t('changelog.fixed'), 'orange'],
] as const;

function Releases({ session }: { session: BrowserSessionV2 }) {
  const notes = useQuery(changelogOptions(session, defaultLanguage));
  if (notes.error) return <RequestState error={notes.error} retry={() => { void notes.refetch(); }} />;
  if (!notes.data) return <RequestState />;
  if (notes.data.entries.length === 0) return <PageState kind="empty" title={t('changelog.empty')} />;
  return (
    <VStack gap={0} className={styles.timeline}>
      {notes.data.fallback && <VStack gap={0} className={styles.notice}><Text type="supporting" color="secondary">{t('changelog.fallback')}</Text></VStack>}
      {notes.data.entries.map(entry => (
        <VStack as="section" key={entry.version} gap={3} aria-label={t('changelog.release', { version: entry.version })}
          className={styles.release + (entry.version === session.cliVersion ? ' ' + styles.current : '')}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Heading level={2}>{entry.version}</Heading>
            {entry.version === session.cliVersion && <Token label={t('changelog.current')} size="sm" color="green" />}
            <Text type="supporting" color="secondary"><time dateTime={entry.date}>{entry.date}</time></Text>
          </HStack>
          {sections.map(([key, label, color]) => entry[key].length > 0 && (
            <VStack key={key} gap={2}>
              <HStack gap={0}><Token label={label} size="sm" color={color} /></HStack>
              <VStack gap={0} className={styles.items}><Markdown>{entry[key].map(item => '- ' + item).join('\n')}</Markdown></VStack>
            </VStack>
          ))}
        </VStack>
      ))}
    </VStack>
  );
}
export function ChangelogPage() {
  const session = useQuery(sessionOptions());
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: t('changelog.title') }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}>
          <Heading level={1}>{t('changelog.title')}</Heading>
          <Text type="supporting" color="secondary">{t('changelog.subtitle')}</Text>
        </VStack>
        {session.error ? <RequestState error={session.error} retry={() => { void session.refetch(); }} />
          : session.data ? <Releases session={session.data} /> : <RequestState />}
      </VStack>
    </VStack>
  );
}
