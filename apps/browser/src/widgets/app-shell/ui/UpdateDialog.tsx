import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { t } from '../../../shared/i18n';

/** How to update. The server never installs anything: the user hands the prompt to their agent or runs the command. */
export function UpdateDialog({ current, latest, close }: { current: string; latest: string; close: () => void }) {
  const onOpenChange = (open: boolean) => { if (!open) close(); };
  // Layout gives the header and body their dialog spacing. A titled CodeBlock puts the copy button in its
  // header bar; without one the button floats over the first line and covers wrapped text.
  return (
    <Dialog isOpen onOpenChange={onOpenChange} purpose="info" width={560}>
      <Layout
        header={<DialogHeader title={t('update.title')} subtitle={t('update.versions', { current, latest })} onOpenChange={onOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={6}>
              <VStack gap={2}>
                <Text type="label">{t('update.promptLabel')}</Text>
                <Text type="supporting" color="secondary">{t('update.promptHelp')}</Text>
                <CodeBlock code={t('update.prompt', { latest })} title={t('update.promptTitle')} language="plaintext" isWrapped width="100%" />
              </VStack>
              <VStack gap={2}>
                <Text type="label">{t('update.commandLabel')}</Text>
                <Text type="supporting" color="secondary">{t('update.commandHelp')}</Text>
                <CodeBlock code={'npm install -g gitifact@' + latest} title={t('update.commandTitle')} language="bash" hasLanguageLabel={false} width="100%" />
              </VStack>
            </VStack>
          </LayoutContent>
        }
      />
    </Dialog>
  );
}
