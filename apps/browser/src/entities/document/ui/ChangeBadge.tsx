import type { SpecEvent } from '@gitifact/contracts';
import { Token } from '@astryxdesign/core/Token';
import { t, useLanguage } from '../../../shared/i18n';
import { KindToken } from './KindToken';
import styles from './change-badge.module.css';

type ChangeType = SpecEvent['types'][number];
const colors = { created: 'green', modified: 'blue', deleted: 'red', moved: 'purple' } as const satisfies Record<ChangeType, string>;

/** The type that colours a change with several: a deletion outweighs an edit, an edit a move, a move a creation. */
export const mainType = (e: Pick<SpecEvent, 'types'>): ChangeType =>
  e.types.includes('deleted') ? 'deleted' : e.types.includes('modified') ? 'modified' : e.types.includes('moved') ? 'moved' : 'created';

/**
 * What happened to a document and what kind of document it is, as one badge in two halves: the change on the left,
 * the kind on the right, joined edge to edge so the pair reads as one thing and each half keeps its own colour.
 */
export function ChangeBadge({ event }: { event: Pick<SpecEvent, 'types' | 'kind'> }) {
  useLanguage();
  const names: Record<ChangeType, string> = { created: t('change.created'), modified: t('change.modified'), deleted: t('change.deleted'), moved: t('change.moved') };
  return <span className={styles.badge}>
    <Token label={event.types.map(type => names[type]).join(' · ')} color={colors[mainType(event)]} size="sm"/>
    <KindToken kind={event.kind}/>
  </span>;
}
