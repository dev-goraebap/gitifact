import { useState } from 'react';
import type { SpecFeature } from '@gitifact/contracts';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { ChangeBadge } from '../../../entities/document';
import { ChangeBody, type Change } from './ChangeBody';
import styles from './commit.module.css';
import { useLanguage } from '../../../shared/i18n';

/** A record explaining more documents than this starts with them closed, so the page opens on the record itself. */
const OPEN_UP_TO = 3;

/**
 * The documents a record explains, a row each that opens to its differences. A few start open; a record that swept
 * twenty documents lists their titles and the reader opens the ones they came for. A document the address names
 * starts open, and a closed row reads nothing.
 */
export function RecordDocuments({ changes, features, head, documentId }: { changes: Change[]; features: SpecFeature[]; head: string | null; documentId?: string | undefined }) {
  useLanguage();
  const [open, setOpen] = useState<string[]>(() => changes.length <= OPEN_UP_TO ? changes.map(c => c.event.key)
    : changes.filter(c => c.event.id === documentId).map(c => c.event.key));
  return <CollapsibleGroup type="multiple" hasDividers chevronPosition="start" value={open} onChange={value => setOpen(Array.isArray(value) ? value : [value])}>
    {changes.map(change => {
      const spec = change.after ?? change.before;
      return <Collapsible key={change.event.key} value={change.event.key} trigger={<HStack id={change.event.id} gap={2} className={styles.documentRow}>
        <ChangeBadge event={change.event}/>
        <Text weight="semibold" className={styles.documentTitle}>{spec?.title ?? change.event.id}</Text>
      </HStack>}>
        {open.includes(change.event.key) && <ChangeBody change={change} features={features} head={head}/>}
      </Collapsible>;
    })}
  </CollapsibleGroup>;
}
