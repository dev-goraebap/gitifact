import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { Button } from '@astryxdesign/core/Button';
import { PageState } from '../page-state';
import { InlineLoader } from './PageLoading';
import { t, useLanguage } from '../../i18n';

/**
 * A read that has not answered yet, or has failed. A screen's first reads are primed by its route before it is shown, so
 * this is for the reads a screen starts itself, and for failures; `placeholder` replaces the small rocket shown in place.
 */
export function RequestState({ error, retry, placeholder }: { error?: Error | null; retry?: () => void; placeholder?: ReactNode }) {
  useLanguage();
  if (error) return <VStack role="alert"><PageState kind="error" title={t('request.failed')} description={error.message}
    actions={retry ? <Button label={t('common.reconnect')} onClick={retry} /> : undefined} /></VStack>;
  return placeholder ?? <InlineLoader/>;
}
