import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * Tells the reader the project changed since the screen was read — an agent edited a document or committed — and
 * offers to read it again. The screen stays as it is until they do, so nothing moves while it is being read.
 */
export function StaleNotice({ isRefreshing, onRefresh }: { isRefreshing: boolean; onRefresh: () => void }) {
  useLanguage();
  return <Banner status="info" title={t('stale.title')} description={t('stale.description')}
    endContent={<Button label={t('common.refresh')} isDisabled={isRefreshing} onClick={onRefresh}/>}/>;
}
