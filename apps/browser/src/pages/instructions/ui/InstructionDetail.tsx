import { useQueryClient } from '@tanstack/react-query';
import type { BrowserSessionV3, SpecFeature, SpecInstruction } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { instructionFileOptions } from '../../../entities/project';
import { DocumentBody } from '../../../shared/ui/document';
import { RelatedList, RelatedItem } from '../../../shared/ui/related-list';
import { InstructionMark } from './InstructionMark';
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
 * One instruction: its heading, the files of its folder beside the one being read (index.md unless `file` names
 * another), and the designs that say they follow it.
 */
export function InstructionDetail({ instruction, color, file, features, session }: { instruction: SpecInstruction; color: InstructionColor | undefined; file: string | undefined; features: SpecFeature[]; session: BrowserSessionV3 }) {
  useLanguage();
  const chosen = file && instruction.files.find(f => f.path === file);
  const folder = instruction.path.slice(0, -INDEX.length);
  const followedBy = features.flatMap(feature => feature.designs.filter(d => d.sources.some(s => s.id === instruction.id)).map(design => ({ feature, design })));
  // A file is read as the pointer or focus reaches its row, so opening it swaps the text instead of dropping to a
  // skeleton first: the drop and regrowth shook the page on every switch.
  const client = useQueryClient();
  const prefetch = (f: SpecInstruction['files'][number]) => { void client.prefetchQuery(instructionFileOptions(session, instruction.id, f.path, f.size)); };
  const fileHref = (path?: string) => `/instructions/${encodeURIComponent(instruction.id)}${path ? '?file=' + encodeURIComponent(path) : ''}`;
  return <VStack as="article" gap={0} aria-label={instruction.title}>
    <VStack gap={3} className={styles.heading}>
      <HStack gap={3} vAlign="center">
        <InstructionMark color={color} title={instruction.title} size="lg"/>
        <Heading level={1}>{instruction.title}</Heading>
      </HStack>
      <Text color="secondary">{instruction.description}</Text>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('instructions.folder')}><Text type="code">{instruction.name}</Text></MetadataListItem>
        <MetadataListItem label="ID">{instruction.id}</MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{instruction.updatedAt ? <Timestamp value={instruction.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
      <Link to="/records" search={{ document: 'instruction', q: instruction.id }} className={styles.activity}>{t('instructions.activity')}</Link>
    </VStack>

    <HStack gap={0} className={styles.reader}>
      <VStack as="nav" gap={1} aria-label={t('instructions.files')} className={styles.files}>
        <Text type="supporting" color="secondary">{t('instructions.files')}</Text>
        <List density="compact">
          <ListItem label={INDEX} href={fileHref()} isSelected={!chosen}/>
        </List>
        {byFolder(instruction.files).map(([name, files]) => <VStack key={name} gap={0} className={name ? styles.fileGroup : undefined}>
          {name && <Text type="supporting" color="secondary" className={styles.folder}>{name}/</Text>}
          <List density="compact" aria-label={name || INDEX}>
            {files.map(f => <ListItem key={f.path} label={f.path.slice(name ? name.length + 1 : 0)} href={fileHref(f.path)} isSelected={chosen === f}
              onMouseEnter={() => prefetch(f)} onFocus={() => prefetch(f)}
              endContent={<Text type="supporting" color="secondary">{sizeOf(f.size)}</Text>}/>)}
          </List>
        </VStack>)}
        {instruction.filesLimited && <Text type="supporting" color="secondary">{t('instructions.filesLimited')}</Text>}
      </VStack>
      <VStack gap={0} className={styles.content}>
        <Text type="supporting" color="secondary" className={styles.filePath}>{folder + (chosen ? chosen.path : INDEX)}</Text>
        {file && !chosen ? <Text color="secondary">{t('instructions.fileMissing', { path: file })}</Text>
          : chosen ? <InstructionFileView session={session} instruction={instruction} file={chosen}/>
          : <DocumentBody path={instruction.path}>{instruction.body}</DocumentBody>}
      </VStack>
    </HStack>

    {followedBy.length > 0 && <VStack gap={0} className={styles.related}>
      <RelatedList label={t('instructions.followedBy')}>
        {followedBy.map(({ feature, design }) => <RelatedItem key={design.id}
          title={<Link to="/features/$featureId" params={{ featureId: feature.id }} search={{ tab: 'design' }} hash={design.id}>{design.title}</Link>}
          description={feature.title}/>)}
      </RelatedList>
    </VStack>}
  </VStack>;
}
