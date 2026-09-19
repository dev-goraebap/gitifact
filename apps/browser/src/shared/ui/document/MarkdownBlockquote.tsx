import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Blockquote } from '@astryxdesign/core/Blockquote';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import AlertDiamondIcon from '@hugeicons/core-free-icons/AlertDiamondIcon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import Idea01Icon from '@hugeicons/core-free-icons/Idea01Icon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import Megaphone01Icon from '@hugeicons/core-free-icons/Megaphone01Icon';
import { SvgIcon } from '../icons/SvgIcon';
import { t } from '../../i18n';
import styles from './document.module.css';

/**
 * Astryx Markdown `components.blockquote`. A GitHub alert (`> [!NOTE]`) is a blockquote whose first text starts with
 * the marker, so the marker is taken out of the rendered children and becomes a labelled box; every other blockquote
 * keeps Astryx's Blockquote. Astryx reserves Blockquote for quotations, so the alert is built from layout components
 * and color tokens instead.
 */
const kinds = {
  NOTE: { icon: InformationCircleIcon, label: () => t('markdown.alertNote'), tone: styles.alertNote },
  TIP: { icon: Idea01Icon, label: () => t('markdown.alertTip'), tone: styles.alertTip },
  IMPORTANT: { icon: Megaphone01Icon, label: () => t('markdown.alertImportant'), tone: styles.alertImportant },
  WARNING: { icon: Alert02Icon, label: () => t('markdown.alertWarning'), tone: styles.alertWarning },
  CAUTION: { icon: AlertDiamondIcon, label: () => t('markdown.alertCaution'), tone: styles.alertCaution },
} satisfies Record<string, { icon: Parameters<typeof SvgIcon>[0]['data']; label: () => string; tone: string | undefined }>;
type Kind = keyof typeof kinds;

const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n?/;

/** Finds the marker in the first text of the blockquote and returns the content without it, keeping the rest as is. */
function takeMarker(node: ReactNode): { kind: Kind; body: ReactNode } | undefined {
  if (typeof node === 'string') {
    const match = marker.exec(node);
    return match ? { kind: match[1] as Kind, body: node.slice(match[0].length) } : undefined;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return undefined;
    const found = takeMarker(node[0]);
    return found ? { kind: found.kind, body: [found.body, ...node.slice(1)] } : undefined;
  }
  if (isValidElement(node)) {
    const found = takeMarker((node.props as { children?: ReactNode }).children);
    return found ? { kind: found.kind, body: cloneElement(node as ReactElement<{ children?: ReactNode }>, undefined, found.body) } : undefined;
  }
  return undefined;
}

export function MarkdownBlockquote({ children }: { children: ReactNode }) {
  const alert = takeMarker(children);
  if (!alert) return <Blockquote className={styles.blockquote}>{children}</Blockquote>;
  const kind = kinds[alert.kind];
  return (
    <VStack gap={1} className={[styles.alert, kind.tone].filter(Boolean).join(' ')}>
      <HStack gap={2} align="center" className={styles.alertLabel}>
        <SvgIcon data={kind.icon} size={18}/>
        <Text type="label" weight="semibold">{kind.label()}</Text>
      </HStack>
      {alert.body}
    </VStack>
  );
}
