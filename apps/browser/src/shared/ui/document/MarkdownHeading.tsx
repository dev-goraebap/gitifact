import type { ReactNode } from 'react';
import { Heading } from '@astryxdesign/core/Heading';
import { useCurrentHeading } from './document-scope';
import styles from './document.module.css';

/**
 * Astryx Markdown `components.heading`. It keeps the id Markdown generated, so the outline and hash links still
 * land on it, and marks the one the reader was sent to. `<mark>` is what the mark means, and the stroke is drawn
 * across the words rather than beside the block: a rule at the edge of a long section says something is here, not
 * which line to read.
 */
export function MarkdownHeading({ level, children, id }: { level: 1 | 2 | 3 | 4 | 5 | 6; children: ReactNode; id?: string }) {
  const isCurrent = !!id && id === useCurrentHeading();
  if (!isCurrent) return <Heading level={level} id={id}>{children}</Heading>;
  return <Heading level={level} id={id} className={styles.currentHeading} aria-current="location"><mark className={styles.currentMark}>{children}</mark></Heading>;
}
