import type { ReactNode } from 'react';
import { DocumentLink } from './DocumentLink';
import { useResolvedLink } from './document-scope';

/** Astryx Markdown `components.link`: resolves the written href against the current document before rendering. */
export function MarkdownLink({ href, children }: { href: string; children: ReactNode }) {
  return <DocumentLink link={useResolvedLink(href)}>{children}</DocumentLink>;
}
