import type { ReactNode } from 'react';
import type { BrowserCommitV4 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Person } from '../../../entities/contributor';
import styles from './commit.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The head of a commit or record page: its title, then who made the commit and when. `hash` replaces the plain commit
 * hash — the record page makes it a link to the commit — and `children` add lines under the meta.
 */
export function CommitHeading({ title, commit, hash, children }: { title: string; commit: Pick<BrowserCommitV4, 'commit' | 'author' | 'email' | 'committer' | 'date'>; hash?: ReactNode; children?: ReactNode }) {
  useLanguage();
  return <VStack gap={4} className={styles.commitHeading}>
    <Heading level={1}>{title}</Heading>
    <HStack gap={4} wrap="wrap" className={styles.commitMeta}>
      <Person name={commit.author} email={commit.email}/>
      <Timestamp value={commit.date} format="relative"/>
      <Text type="supporting" color="secondary">{new Date(commit.date).toLocaleString()}</Text>
      {hash ?? <Text type="supporting" color="secondary" className={styles.commitHash}>{commit.commit.slice(0, 12)}</Text>}
      {commit.committer !== commit.author && <Text type="supporting" color="secondary">{t('event.committer', { name: commit.committer })}</Text>}
    </HStack>
    {children}
  </VStack>;
}

