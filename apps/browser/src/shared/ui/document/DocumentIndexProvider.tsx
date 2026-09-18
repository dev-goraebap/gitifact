import type { ReactNode } from 'react';
import { DocumentIndexContext } from './document-scope';
import type { DocumentIndex } from './resolveDocumentLink';

export function DocumentIndexProvider({ index, children }: { index: DocumentIndex; children: ReactNode }) {
  return <DocumentIndexContext.Provider value={index}>{children}</DocumentIndexContext.Provider>;
}
