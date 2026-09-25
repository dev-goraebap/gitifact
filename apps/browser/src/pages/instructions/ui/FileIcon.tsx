import { HgiDocument } from '../../../shared/ui/icons/HgiDocument';
import { HgiFileCode } from '../../../shared/ui/icons/HgiFileCode';
import { HgiImage } from '../../../shared/ui/icons/HgiImage';

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;

/** What a file of an instruction folder is at a glance: a reference to read, an image, or other text such as a script. */
export function FileIcon({ path }: { path: string }) {
  return path.toLowerCase().endsWith('.md') ? <HgiDocument size={16}/> : IMAGE.test(path) ? <HgiImage/> : <HgiFileCode/>;
}
