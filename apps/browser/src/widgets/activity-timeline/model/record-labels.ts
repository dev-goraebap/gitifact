import type { SpecRecord } from '@gitifact/contracts';
import { t } from '../../../shared/i18n';

type SectionKey = SpecRecord['sections'][number]['key'];

/** A record section named in the reader's language, whatever language its heading was written in. */
export const sectionLabel: Record<SectionKey, () => string> = {
  context: () => t('record.section.context'), decision: () => t('record.section.decision'), alternatives: () => t('record.section.alternatives'),
};
