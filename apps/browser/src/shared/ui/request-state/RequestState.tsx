import { useEffect, useState } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { PageState } from '../page-state';
import { t, useLanguage } from '../../i18n';

export function RequestState({ error, retry }: { error?: Error | null; retry?: () => void }) {
  useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 200);
    return () => window.clearTimeout(timer);
  }, []);
  if (error) return <VStack role="alert"><PageState kind="error" title={t('request.failed')} description={error.message}
    actions={retry ? <Button label={t('common.reconnect')} onClick={retry} /> : undefined} /></VStack>;
  return <VStack padding={6} gap={6} role="status" aria-label={t('request.loading')} aria-busy="true" style={{minHeight:'24rem', opacity:visible?1:0, transition:'opacity .2s ease-out'}}>
    <Text type="supporting" color="secondary">{t('request.loadingRecords')}</Text>
    {[0,1,2,3].map(index => <HStack key={index} gap={5} aria-hidden="true">
      <VStack gap={3} style={{flex:1}}><Skeleton index={index} width={`${52-index*7}%`} height="var(--spacing-4)" radius="none"/><Skeleton index={index} width="35%" height="var(--spacing-3)" radius="none"/></VStack>
      <Skeleton index={index} width="var(--spacing-8)" height="var(--spacing-8)" radius="rounded"/>
    </HStack>)}
  </VStack>;
}
