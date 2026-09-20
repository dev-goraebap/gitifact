import { Markdown } from '@astryxdesign/core/Markdown';
import { VStack } from '@astryxdesign/core/VStack';
import { CurrentHeadingContext, DocumentPathContext } from './document-scope';
import { MarkdownLink } from './MarkdownLink';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownCode } from './MarkdownCode';
import { MarkdownBlockquote } from './MarkdownBlockquote';
import { MarkdownHeading } from './MarkdownHeading';
import styles from './document.module.css';

const components = { link: MarkdownLink, image: MarkdownImage, code: MarkdownCode, blockquote: MarkdownBlockquote, heading: MarkdownHeading };

/**
 * Markdown as a document to read, not interface text: a 48rem measure shared by prose, code, tables and rules
 * (Astryx otherwise caps prose at 680px while tables and code run wider), 16px body, and a heading scale that
 * stays above the body size at every level. `path` is the document's repository path; links and images inside
 * it resolve relative to that file (see resolveDocumentLink).
 */
export function DocumentBody({ children, headingLevelStart = 2, path, density, currentHeading }: { children: string; headingLevelStart?: 1 | 2 | 3 | 4 | 5 | 6; path?: string | undefined; density?: 'default' | 'compact'; currentHeading?: string | undefined }) {
  return <DocumentPathContext.Provider value={path}><CurrentHeadingContext.Provider value={currentHeading}>
    <VStack gap={0} className={styles.reading}><Markdown headingLevelStart={headingLevelStart} contentWidth="100%" {...(density ? { density } : {})} components={components}>{children}</Markdown></VStack>
  </CurrentHeadingContext.Provider></DocumentPathContext.Provider>;
}
