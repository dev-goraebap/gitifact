import type { SpecFeature } from '@gitifact/contracts';
import { KindToken } from '../../../entities/document';
import { ChangeSection } from './ChangeSection';
import type { Change } from './ChangeBody';
import { SplitReader } from './SplitReader';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * Changed documents read one at a time, as the code is: the documents down the side — what kind each is, its title and
 * what happened to it — and the chosen one's differences beside them. The address names the chosen document in its
 * fragment, as links from elsewhere already write it; without one the first opens. The record page and the commit's
 * documents tab both read documents this way.
 */
export function RecordDocuments({ label, changes, features, head, documentId, href }: { label: string; changes: Change[]; features: SpecFeature[]; head: string | null; documentId?: string | undefined; href: (id: string) => string }) {
  useLanguage();
  const chosen = changes.find(c => c.event.id === documentId) ?? changes[0];
  if (!chosen) return null;
  return <SplitReader label={label}
    items={changes.map(change => { const spec = change.after ?? change.before;
      return { key: change.event.key, label: spec?.title ?? change.event.id, description: change.event.types.map(type => t(`change.${type}`)).join(' · '),
        start: <KindToken kind={change.event.kind}/>, href: href(change.event.id), selected: change === chosen }; })}>
    <ChangeSection key={chosen.event.key} change={chosen} features={features} head={head} current={false}/>
  </SplitReader>;
}
