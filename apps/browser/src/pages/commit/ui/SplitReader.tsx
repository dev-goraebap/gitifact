import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { useNavigate } from '@tanstack/react-router';
import styles from './commit.module.css';

export interface SplitItem { key: string; label: string; description?: string | undefined; start?: ReactNode; end?: ReactNode; href: string; selected: boolean }

/**
 * Many changed files read one at a time, the way a code review is: the files down the side and the chosen one beside
 * them. Each file has its own address, so the list is links. A narrow screen has no room for the list beside the
 * text and no reason to push the text below it, so there the list gives way to one selector over the text.
 */
export function SplitReader({ label, summary, footer, items, children }: { label: string; summary?: ReactNode; footer?: ReactNode; items: SplitItem[]; children: ReactNode }) {
  const navigate = useNavigate();
  const selected = items.find(item => item.selected);
  return <HStack gap={0} className={styles.split}>
    <VStack as="nav" gap={2} aria-label={label} className={styles.splitList}>
      {summary}
      <List density="compact">
        {items.map(item => <ListItem key={item.key} label={item.label} description={item.description} href={item.href} isSelected={item.selected}
          startContent={item.start} endContent={item.end}/>)}
      </List>
      {footer}
    </VStack>
    <VStack gap={3} className={styles.splitContent}>
      <VStack gap={0} className={styles.splitPicker}>
        <Selector label={label} isLabelHidden width="100%" value={selected?.key ?? ''}
          options={items.map(item => ({ value: item.key, label: item.label, ...(item.description ? { description: item.description } : {}) }))}
          onChange={key => { const item = items.find(i => i.key === key); if (item) void navigate({ href: item.href }); }}/>
      </VStack>
      {footer && <VStack gap={0} className={styles.splitPickerMore}>{footer}</VStack>}
      {children}
    </VStack>
  </HStack>;
}
