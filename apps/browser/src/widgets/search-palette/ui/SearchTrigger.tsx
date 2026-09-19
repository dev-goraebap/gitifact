import { Kbd } from '@astryxdesign/core/Kbd';
import { Text } from '@astryxdesign/core/Text';
import SearchIcon from '@hugeicons/core-free-icons/Search01Icon';
import { SvgIcon } from '../../../shared/ui/icons/SvgIcon';
import { openSearch } from '../../../shared/lib/search';
import { t } from '../../../shared/i18n';
import styles from './search-palette.module.css';

/**
 * The visible way into search, shaped like the field it opens so it reads as one. The shortcut is printed on it
 * because a hotkey nobody can see is not a way in; below 48rem only the glyph stays, since the header is a thin bar.
 */
export function SearchTrigger() {
  return <button type="button" className={styles.trigger} onClick={openSearch} aria-label={t('search.open')} aria-keyshortcuts="Meta+K Control+K">
    <SvgIcon data={SearchIcon} size={16}/>
    <Text type="supporting" color="secondary">{t('search.trigger')}</Text>
    <Kbd keys="mod+k"/>
  </button>;
}
