import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import ClipboardCheckIcon from '@hugeicons/core-free-icons/ClipboardCheckIcon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import HistoryIcon from '@hugeicons/core-free-icons/HistoryIcon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import PencilEdit01Icon from '@hugeicons/core-free-icons/PencilEdit01Icon';
import { iconType } from './icon-type';

// The icons at the start of the list filters: what each one narrows by. A feature and a record are drawn as the menu
// draws the feature requirements and the records, so the same thing looks the same wherever it appears.
export const SearchIcon = iconType(Search01Icon);
export const FeatureIcon = iconType(ClipboardCheckIcon);
export const DocumentKindIcon = iconType(File01Icon);
export const RecordIcon = iconType(HistoryIcon);
export const PersonIcon = iconType(UserIcon);
export const DesignIcon = iconType(PencilEdit01Icon);
