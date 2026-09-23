import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { List, ListItem } from '@astryxdesign/core/List';
import styles from './related-list.module.css';

/**
 * One kind of related document under a small label, one per row: the documents a design explains or draws on, the
 * designs that name a requirement, where its history is. Each kind keeps its own block, so a reader never has to
 * tell the kinds apart inside one run of links.
 */
export function RelatedList({ label, children }: { label: string; children: ReactNode }) {
  return <VStack as="section" gap={1} aria-label={label} className={styles.related}>
    <Text type="supporting" color="secondary">{label}</Text>
    <List density="compact">{children}</List>
  </VStack>;
}

/** A row: the document as a link (or plain text when it is gone), with a line about it beneath. */
export function RelatedItem({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return <ListItem label={title} {...(description ? { description: typeof description === 'string' ? <Text type="supporting" color="secondary">{description}</Text> : description } : {})}/>;
}
