import type { SpecRequirement } from '@gitifact/contracts';
import { Token } from '@astryxdesign/core/Token';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * A requirement written as a use case, as a small neutral badge on its number line. The body is drawn as written, so
 * this is the only sign of the shape; a requirement in the default shape shows nothing.
 */
export function StyleToken({ style }: { style: SpecRequirement['style'] }) {
  useLanguage();
  if (style !== 'usecase') return null;
  return <Token label={t('features.usecase')} color="default" size="sm"/>;
}
