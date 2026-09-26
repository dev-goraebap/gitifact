import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { Button } from '@astryxdesign/core/Button';
import { PageState } from '../page-state';
import { InlineLoader, usePageLoading, usePageRevealed } from './PageLoading';
import { t, useLanguage } from '../../i18n';

/**
 * A read that has not answered yet, or has failed. While it runs, the frame's loader covers the screen until everything
 * the screen needs has answered; a read that starts after the screen is on view shows `placeholder` in place instead.
 */
export function RequestState({ error, retry, placeholder }: { error?: Error | null; retry?: () => void; placeholder?: ReactNode }) {
  useLanguage();
  usePageLoading(!error);
  const revealed = usePageRevealed();
  if (error) return <VStack role="alert"><PageState kind="error" title={t('request.failed')} description={error.message}
    actions={retry ? <Button label={t('common.reconnect')} onClick={retry} /> : undefined} /></VStack>;
  return revealed ? placeholder ?? <InlineLoader/> : null;
}
