import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { t } from '../../../shared/i18n';

/** How to update. The server never installs anything: the user hands the prompt to their agent or runs the command. */
export function UpdateDialog({ current, latest, close }: { current: string; latest: string; close: () => void }) {
  const onOpenChange = (open: boolean) => { if (!open) close(); };
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose="info" width={560} padding={0}>
      <DialogHeader title={t('update.title')} subtitle={t('update.versions', { current, latest })} onOpenChange={onOpenChange} />
      <VStack padding={6} gap={6}>
        <VStack gap={2}>
          <Text type="label">{t('update.promptLabel')}</Text>
          <Text type="supporting" color="secondary">{t('update.promptHelp')}</Text>
          <CodeBlock code={t('update.prompt', { latest })} language="plaintext" isWrapped width="100%" />
        </VStack>
        <VStack gap={2}>
          <Text type="label">{t('update.commandLabel')}</Text>
          <Text type="supporting" color="secondary">{t('update.commandHelp')}</Text>
          <CodeBlock code={'npm install -g gitifact@' + latest} language="bash" hasLanguageLabel={false} width="100%" />
        </VStack>
      </VStack>
    </Dialog>
  );
}
