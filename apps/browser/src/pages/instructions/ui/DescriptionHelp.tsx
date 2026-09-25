import { IconButton } from '@astryxdesign/core/IconButton';
import { Popover } from '@astryxdesign/core/Popover';
import { Text } from '@astryxdesign/core/Text';
import { HgiHelp } from '../../../shared/ui/icons/HgiHelp';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The `?` beside a title that opens its description: an instruction's or a reference file's. The description stays out
 * of the page so the text being read starts right under the title.
 */
export function DescriptionHelp({ title, description }: { title: string; description: string }) {
  useLanguage();
  return <Popover label={title} width="24rem" hasAutoFocus={false}
    content={<Text>{description}</Text>}>
    <IconButton label={t('instructions.description', { title })} icon={<HgiHelp/>} variant="ghost" size="sm"/>
  </Popover>;
}
