import { createContext, useContext } from 'react';
import { resolveDocumentLink, type DocumentIndex, type ResolvedLink } from './resolveDocumentLink';

/** The wiki pages and features the loaded specs know about; the product pages provide it once for every document below. */
export const DocumentIndexContext = createContext<DocumentIndex>({ documents: [], features: [] });
/** Repository path of the document being rendered, so its relative links have a folder to start from. */
export const DocumentPathContext = createContext<string | undefined>(undefined);

export function useDocumentIndex(): DocumentIndex { return useContext(DocumentIndexContext); }
export function useResolvedLink(href: string): ResolvedLink {
  return resolveDocumentLink(href, useContext(DocumentPathContext), useContext(DocumentIndexContext));
}
