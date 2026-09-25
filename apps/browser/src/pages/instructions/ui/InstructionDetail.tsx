import { useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecInstruction } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { List, ListItem } from '@astryxdesign/core/List';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { instructionFileOptions } from '../../../entities/project';
import { DocumentBody } from '../../../shared/ui/document';
import { HgiBook } from '../../../shared/ui/icons/HgiBook';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import { InstructionMark } from './InstructionMark';
import { FileIcon } from './FileIcon';
import { InstructionFileView } from './InstructionFileView';
import type { InstructionColor } from '../model/instruction-color';
import styles from './instructions.module.css';
import { t, useLanguage } from '../../../shared/i18n';

const INDEX = 'index.md';
/** The files by folder, in the order the checkout lists them: root files first, each folder's files under its name. */
function byFolder(files: SpecInstruction['files']) {
  const groups = new Map<string, SpecInstruction['files']>();
  for (const file of files) {
    const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    groups.set(folder, [...groups.get(folder) ?? [], file]);
  }
  return [...groups].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
}
const sizeOf = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

/**
 * One instruction: its heading and the files of its folder beside the one being read
 * (index.md unless `file` names another).
 */
export function InstructionDetail({ instruction, color, file, session }: { instruction: SpecInstruction; color: InstructionColor | undefined; file: string | undefined; session: BrowserSessionV3 }) {
  useLanguage();
  const chosen = file && instruction.files.find(f => f.path === file);
  const folder = instruction.path.slice(0, -INDEX.length);
  // A file is read as the pointer or focus reaches its row, so opening it swaps the text instead of dropping to a
  // skeleton first: the drop and regrowth shook the page on every switch.
  const client = useQueryClient();
  const prefetch = (f: SpecInstruction['files'][number]) => { void client.prefetchQuery(instructionFileOptions(session, instruction.id, f.path, f.size)); };
  const fileHref = (path?: string) => `/instructions/${encodeURIComponent(instruction.id)}${path ? '?file=' + encodeURIComponent(path) : ''}`;
  return <VStack as="article" gap={0} aria-label={instruction.title}>
    <VStack gap={3} className={styles.heading}>
      <Link to="/instructions" className={styles.back}>{t('instructions.back')}</Link>
      <HStack gap={3} vAlign="center">
        <InstructionMark color={color} title={instruction.title} size="lg"/>
        <Heading level={1}>{instruction.title}</Heading>
      </HStack>
      <Text color="secondary" className={styles.summary}>{instruction.description}</Text>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('instructions.folder')}><Text type="code">{instruction.name}</Text></MetadataListItem>
        <MetadataListItem label="ID">{instruction.id}</MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{instruction.updatedAt ? <Timestamp value={instruction.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
      <Link to="/records" search={{ document: 'instruction', q: instruction.id }} className={styles.activity}>{t('instructions.activity')}</Link>
    </VStack>

    <HStack gap={0} className={styles.reader}>
      <VStack as="nav" gap={1} aria-label={t('instructions.files')} className={styles.files}>
        <Text type="supporting" color="secondary" className={styles.filesHeading}>{t('instructions.files')}</Text>
        <List density="compact">
          <ListItem label={instruction.title} href={fileHref()} isSelected={!chosen} startContent={<HgiBook/>}/>
        </List>
        {byFolder(instruction.files).map(([name, files]) => {
          // A reference file goes by the title in its frontmatter; the file name stays for files without one.
          const list = <List density="compact" aria-label={name || INDEX}>
            {files.map(f => <ListItem key={f.path} label={f.title ?? f.path.slice(name ? name.length + 1 : 0)} href={fileHref(f.path)} isSelected={chosen === f}
              onMouseEnter={() => prefetch(f)} onFocus={() => prefetch(f)} startContent={<FileIcon path={f.path}/>}
              endContent={<Text type="supporting" color="secondary">{sizeOf(f.size)}</Text>}/>)}
          </List>;
          // Folders start open and fold away when a long list gets in the way; their files sit under the folder name.
          return name ? <VStack key={name} gap={0} className={styles.fileGroup}>
            <Collapsible chevronPosition="start" trigger={<HStack gap={2} vAlign="center" className={styles.folder}>
              <HgiFolder/><Text type="supporting" color="secondary" className={styles.folderName}>{name}/</Text>
            </HStack>}><VStack gap={0} className={styles.folderFiles}>{list}</VStack></Collapsible>
          </VStack> : <VStack key={name} gap={0}>{list}</VStack>;
        })}
        {instruction.filesLimited && <Text type="supporting" color="secondary">{t('instructions.filesLimited')}</Text>}
      </VStack>
      <VStack gap={0} className={styles.content}>
        <Text type="supporting" color="secondary" className={styles.filePath}>{folder + (chosen ? chosen.path : INDEX)}</Text>
        {chosen && chosen.title && <VStack gap={1} className={styles.fileTitle}>
          <Heading level={2}>{chosen.title}</Heading>
          {chosen.description && <Text color="secondary">{chosen.description}</Text>}
        </VStack>}
        {file && !chosen ? <Text color="secondary">{t('instructions.fileMissing', { path: file })}</Text>
          : chosen ? <InstructionFileView session={session} instruction={instruction} file={chosen}/>
          : <DocumentBody path={instruction.path}>{instruction.body}</DocumentBody>}
      </VStack>
    </HStack>
  </VStack>;
}
