import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { useNavigate } from '@tanstack/react-router';
import styles from './commit.module.css';

/** `onIntent` runs when the pointer or the focus comes to an item, so what it opens can be read ahead. */
export interface SplitItem { key: string; label: string; description?: string | undefined; start?: ReactNode; end?: ReactNode; href: string; selected: boolean; onIntent?: () => void }

/**
 * Many changed files read one at a time, the way a code review is: the files down the side and the chosen one beside
 * them. Each file has its own address, so the list is links. A narrow screen has no room for the list beside the
 * text and no reason to push the text below it, so there the list gives way to one selector over the text.
 */
export function SplitReader({ label, summary, footer, items, children }: { label: string; summary?: ReactNode; footer?: ReactNode; items: SplitItem[]; children: ReactNode }) {
  const navigate = useNavigate();
  const selected = items.find(item => item.selected);
  // The list items take no pointer handlers of their own, so the list hears for them: the link under the pointer or focus.
  const intent = (target: EventTarget) => { const href = (target as Element).closest?.('a[href]')?.getAttribute('href'); items.find(item => item.href === href)?.onIntent?.(); };
  return <HStack gap={0} className={styles.split}>
    <VStack as="nav" gap={2} aria-label={label} className={styles.splitList} onMouseOver={e => intent(e.target)} onFocus={e => intent(e.target)}>
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
