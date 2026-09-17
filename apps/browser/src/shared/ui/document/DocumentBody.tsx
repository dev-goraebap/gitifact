import { Markdown } from '@astryxdesign/core/Markdown';
import { VStack } from '@astryxdesign/core/VStack';
import styles from './document.module.css';

/**
 * Markdown as a document to read, not interface text: a 48rem measure shared by prose, code, tables and rules
 * (Astryx otherwise caps prose at 680px while tables and code run wider), 16px body, and a heading scale that
 * stays above the body size at every level.
 */
export function DocumentBody({ children, headingLevelStart = 2 }: { children: string; headingLevelStart?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  return <VStack gap={0} className={styles.reading}><Markdown headingLevelStart={headingLevelStart} contentWidth="100%">{children}</Markdown></VStack>;
}
