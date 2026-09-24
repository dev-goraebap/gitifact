import { createContext, useContext } from 'react';
import { resolveDocumentLink, type DocumentIndex, type ResolvedLink } from './resolveDocumentLink';

/** The features and instructions the loaded specs know about; the product pages provide it once for every document below. */
export const DocumentIndexContext = createContext<DocumentIndex>({ features: [] });
/** Repository path of the document being rendered, so its relative links have a folder to start from. */
export const DocumentPathContext = createContext<string | undefined>(undefined);
/** Id of the heading the reader was sent to, so the section it opens is marked as the one that was meant. */
export const CurrentHeadingContext = createContext<string | undefined>(undefined);

export function useDocumentIndex(): DocumentIndex { return useContext(DocumentIndexContext); }
export function useCurrentHeading(): string | undefined { return useContext(CurrentHeadingContext); }
export function useResolvedLink(href: string): ResolvedLink {
  return resolveDocumentLink(href, useContext(DocumentPathContext), useContext(DocumentIndexContext));
}
