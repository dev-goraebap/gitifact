import type { SpecDocument } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link, useNavigate } from '@tanstack/react-router';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import { HgiDocument } from '../../../shared/ui/icons/HgiDocument';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { StateIllustration } from '../../../shared/ui/page-state/StateIllustration';
import { DocumentBody, wikiEntryPath } from '../../../shared/ui/document';
import { t } from '../../../shared/i18n';

/** Path inside the wiki folder, e.g. `frontend/layout.md` for `.gitifact/wiki/frontend/layout.md`. */
export const relativePath = (doc: SpecDocument) => doc.path.replace(/^\.gitifact\/wiki\//, '');
/** A banner image as the very first block of the entry page duplicates the wordmark already in the side nav; it is dropped, every other image stays. */
export const withoutLeadingBanner = (body: string) => body.replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*\n+/, '');
const bodyOf = (doc: SpecDocument) => doc.path === wikiEntryPath ? withoutLeadingBanner(doc.body) : doc.body;

type Node = { name: string; path: string; folders: Node[]; documents: SpecDocument[] };
function tree(documents: SpecDocument[]): Node {
  const root: Node = { name: '', path: '', folders: [], documents: [] };
  for (const doc of documents) {
    const parts = relativePath(doc).split('/'); let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.folders.find(f => f.name === part);
      if (!next) { next = { name: part, path: node.path ? `${node.path}/${part}` : part, folders: [], documents: [] }; node.folders.push(next); }
      node = next;
    }
    node.documents.push(doc);
  }
  const sort = (n: Node) => { n.folders.sort((a, b) => a.name.localeCompare(b.name)); n.documents.sort((a, b) => a.path.localeCompare(b.path)); n.folders.forEach(sort); };
  sort(root); return root;
}
const countDocuments = (node: Node): number => node.documents.length + node.folders.reduce((sum, folder) => sum + countDocuments(folder), 0);
const folderOf = (doc: SpecDocument) => relativePath(doc).split('/').slice(0, -1).join('/');
/** Walks the folder chain named by `folder`; unknown segments stop at the last known folder. */
function chainOf(root: Node, folder: string): Node[] {
  const chain: Node[] = [root];
  for (const part of folder.split('/').filter(Boolean)) {
    const next = chain[chain.length - 1]!.folders.find(f => f.name === part);
    if (!next) break; chain.push(next);
  }
  return chain;
}

export function DocumentsView({ documents, documentId, search }: { documents: SpecDocument[]; documentId?: string | undefined; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const selected = documentId ? documents.find(d => d.id === documentId) : undefined;
  if (documentId && !selected) return <PageState kind="not-found" title={t('documents.notFoundTitle')} description={t('documents.notFoundDescription', { id: documentId })} actions={<Link to="/wiki">{t('documents.backToList')}</Link>}/>;
  if (selected) return <DocumentPage doc={selected}/>;
  if (!documents.length) return <PageState kind="empty" title={t('documents.emptyTitle')} description={t('documents.emptyDescription')}/>;
  return <ColumnBrowser documents={documents} search={search}/>;
}

/** Finder-style columns across the whole content area: each folder opens to the right, a chosen document previews in the remaining space. */
function ColumnBrowser({ documents, search }: { documents: SpecDocument[]; search: ProductSearch }) {
  const navigate = useNavigate();
  const preview = search.selected ? documents.find(d => d.id === search.selected) : undefined;
  // A previewed document keeps its own folder open even when the URL only names the document.
  const chain = chainOf(tree(documents), search.folder ?? (preview ? folderOf(preview) : ''));
  const openFolder = (path: string) => { void navigate({ to: '/wiki', search: { folder: path || undefined } }); };
  const openDocument = (doc: SpecDocument) => { void navigate({ to: '/wiki', search: { folder: folderOf(doc) || undefined, selected: doc.id } }); };
  return <HStack gap={0} className={styles.columns} aria-label={t('documents.browse')}>
    {chain.map((node, index) => {
      const nextName = chain[index + 1]?.name;
      const items = [...node.folders.map(f => ({ key: 'd:' + f.path, folder: f })), ...node.documents.map(d => ({ key: d.id, doc: d }))];
      return <VStack key={node.path || 'root'} gap={0} className={styles.browserColumn} aria-label={node.name || t('documents.document')}>
        {items.length ? <List density="compact">
          {items.map(item => 'folder' in item
            ? <ListItem key={item.key} label={item.folder.name} description={t('documents.folderCount', { count: countDocuments(item.folder) })} startContent={<HgiFolder size={16}/>} endContent={<Text type="supporting" color="secondary">›</Text>} isSelected={item.folder.name === nextName} onClick={() => openFolder(item.folder.path)}/>
            : <ListItem key={item.key} label={item.doc.title} description={relativePath(item.doc).split('/').pop()} startContent={<HgiDocument size={16}/>} isSelected={item.doc.id === preview?.id} onClick={() => openDocument(item.doc)}/>)}
        </List> : <Text type="supporting" color="secondary">{t('documents.emptyFolder')}</Text>}
      </VStack>;
    })}
    {preview ? <VStack gap={0} className={styles.preview} aria-label={t('documents.preview')}>
      <HStack gap={3} wrap="wrap" className={styles.previewHead}>
        <VStack gap={1} className={styles.previewTitle}>
          <Heading level={2}>{preview.title}</Heading>
          <Text type="supporting" color="secondary">{relativePath(preview)} · {preview.id}</Text>
        </VStack>
        <Button label={t('documents.openDetail')} size="sm" onClick={() => { void navigate({ to: '/wiki/$documentId', params: { documentId: preview.id } }); }}/>
      </HStack>
      <VStack gap={0} className={styles.previewBody}><DocumentBody headingLevelStart={3} density="compact" path={preview.path}>{bodyOf(preview)}</DocumentBody></VStack>
    </VStack> : <VStack gap={3} className={styles.columnFiller} aria-hidden="true">
      <StateIllustration kind="empty" compact/>
      <Text type="supporting" color="secondary">{t('documents.choose')}</Text>
    </VStack>}
  </HStack>;
}

function DocumentPage({ doc }: { doc: SpecDocument }) {
  return <VStack as="article" aria-label={t('documents.document')} gap={0} className={styles.featureDetail}>
    <Link to="/wiki" search={{ folder: folderOf(doc) || undefined, selected: doc.id }} className={styles.featureBack}>← {t('nav.wiki')}{folderOf(doc) ? ` / ${folderOf(doc)}` : ''}</Link>
    <VStack gap={3} className={styles.documentHeading}>
      <Heading level={1}>{doc.title}</Heading>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('common.path')}>{relativePath(doc)}</MetadataListItem>
        <MetadataListItem label="ID">{doc.id}</MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{doc.updatedAt ? <Timestamp value={doc.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
      <Link to="/" search={{ document: 'wiki', q: doc.id }}>{t('documents.activity')}</Link>
    </VStack>
    <VStack gap={0} className={styles.documentBody}><DocumentBody path={doc.path}>{bodyOf(doc)}</DocumentBody></VStack>
  </VStack>;
}
