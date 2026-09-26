import type { ReactNode } from 'react';
import type { IndexFeature } from '@gitifact/contracts';
import { KindToken } from '../../../entities/document';
import { ChosenChange } from './ChosenChange';
import type { Change, ListedChange } from './ChangeBody';
import { SplitReader } from './SplitReader';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * How the chosen document's text is read: a hook that queries one document, since the list carries none of it. The
 * commit pages read it from the commit, the uncommitted page from HEAD and the working tree.
 */
export type UseChange = (id: string) => { data: Change | undefined; error: Error | null; refetch: () => unknown };

/**
 * Changed documents read one at a time, as the code is: the documents down the side — what kind each is, its title and
 * what happened to it — and the chosen one's differences beside them. The list names the documents only; the chosen
 * one's text is read when it is opened. The address names the chosen document in its fragment, as links from elsewhere
 * already write it; without one the first opens. The record page, the commit's documents tab and the uncommitted page
 * read documents this way. `more` goes under the list, for a list that is read a page at a time.
 */
export function RecordDocuments({ label, changes, useChange, features, head, documentId, href, more }: { label: string; changes: ListedChange[]; useChange: UseChange; features: IndexFeature[];
  head: string | null; documentId?: string | undefined; href: (id: string) => string; more?: ReactNode }) {
  useLanguage();
  const chosen = changes.find(c => c.id === documentId) ?? changes[0];
  if (!chosen) return null;
  return <SplitReader label={label} footer={more}
    items={changes.map(change => ({ key: change.key, label: change.title, description: change.types.map(type => t(`change.${type}`)).join(' · '),
      start: <KindToken kind={change.kind}/>, href: href(change.id), selected: change === chosen }))}>
    <ChosenChange key={chosen.key} id={chosen.id} useChange={useChange} features={features} head={head}/>
  </SplitReader>;
}
