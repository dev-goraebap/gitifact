import type { SpecEvent } from '@gitifact/contracts';
import { Token } from '@astryxdesign/core/Token';
import { t, useLanguage } from '../../../shared/i18n';

type Kind = SpecEvent['kind'];

// Colours apart from the change tokens (green, blue, red, purple) that usually stand beside this one, so the two
// read as two things: what happened, and to what kind of document.
const colors = { feature: 'default', requirement: 'teal', design: 'orange', wiki: 'pink', instruction: 'cyan' } as const satisfies Record<Kind, string>;

/** The kind of a document — feature, requirement, design, wiki page or instruction — as a small token. */
export function KindToken({ kind }: { kind: Kind }) {
  useLanguage();
  const labels: Record<Kind, string> = { feature: t('kind.feature'), requirement: t('kind.requirement'), design: t('kind.design'), wiki: t('kind.wiki'), instruction: t('kind.instruction') };
  return <Token label={labels[kind]} color={colors[kind]} size="sm"/>;
}
