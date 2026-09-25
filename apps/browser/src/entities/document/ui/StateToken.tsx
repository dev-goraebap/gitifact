import type { DocumentState } from '@gitifact/contracts';
import { Token } from '@astryxdesign/core/Token';
import { t, useLanguage } from '../../../shared/i18n';

/** The same colours as a change badge: an addition green, an edit blue, a deletion red. */
export const stateColors = { added: 'green', modified: 'blue', deleted: 'red' } as const satisfies Record<Exclude<DocumentState, 'committed'>, string>;

/**
 * Where a document stands against the last commit, as a small badge beside its title. A committed document shows
 * nothing, so a list stays quiet and only what is not committed yet stands out.
 */
export function StateToken({ state }: { state: DocumentState }) {
  useLanguage();
  if (state === 'committed') return null;
  const labels = { added: t('state.added'), modified: t('state.modified'), deleted: t('state.deleted') };
  return <Token label={labels[state]} color={stateColors[state]} size="sm"/>;
}
