import type { SpecDocument } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Markdown } from '@astryxdesign/core/Markdown';
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
import { t } from '../../../shared/i18n';

// Only guides are browsed as a folder tree; the product description is the dashboard (ProductOverview).
export type DocumentKind = SpecDocument['kind'];
export const documentRoot = { product: '/product', guide: '/guides' } as const;
export const documentLabel = { product: t('nav.product'), guide: t('nav.guides') };
/** Path inside the store folder, e.g. `frontend/layout.md` for `.gitifact/guides/frontend/layout.md`. */
export const relativePath = (doc: SpecDocument) => doc.path.replace(/^\.gitifact\/(?:product|guides)\//, '');

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

export function DocumentsView({ documents, kind, documentId, search }: { documents: SpecDocument[]; kind: DocumentKind; documentId?: string | undefined; search: ProductSearch; change: (s: ProductSearch) => void }) {
  const selected = documentId ? documents.find(d => d.id === documentId) : undefined;
  if (documentId && !selected) return <PageState kind="not-found" title={t('documents.notFoundTitle')} description={t('documents.notFoundDescription', { id: documentId, label: documentLabel[kind] })} actions={<Link to={documentRoot[kind]}>{t('documents.backToList', { label: documentLabel[kind] })}</Link>}/>;
  if (selected) return <DocumentPage doc={selected} kind={kind}/>;
  if (!documents.length) return <PageState kind="empty" title={t('documents.emptyTitle', { label: documentLabel[kind] })} description={t('documents.emptyDescription')}/>;
  return <ColumnBrowser documents={documents} kind={kind} search={search}/>;
}

/** Finder-style columns across the whole content area: each folder opens to the right, a chosen document previews in the remaining space. */
function ColumnBrowser({ documents, kind, search }: { documents: SpecDocument[]; kind: DocumentKind; search: ProductSearch }) {
  const navigate = useNavigate();
  const preview = search.selected ? documents.find(d => d.id === search.selected) : undefined;
  // A previewed document keeps its own folder open even when the URL only names the document.
  const chain = chainOf(tree(documents), search.folder ?? (preview ? folderOf(preview) : ''));
  const openFolder = (path: string) => { void navigate({ to: documentRoot[kind], search: { folder: path || undefined } }); };
  const openDocument = (doc: SpecDocument) => { void navigate({ to: documentRoot[kind], search: { folder: folderOf(doc) || undefined, selected: doc.id } }); };
  return <HStack gap={0} className={styles.columns} aria-label={t('documents.browse', { label: documentLabel[kind] })}>
    {chain.map((node, index) => {
      const nextName = chain[index + 1]?.name;
      const items = [...node.folders.map(f => ({ key: 'd:' + f.path, folder: f })), ...node.documents.map(d => ({ key: d.id, doc: d }))];
      return <VStack key={node.path || 'root'} gap={0} className={styles.browserColumn} aria-label={node.name || t('documents.document', { label: documentLabel[kind] })}>
        {items.length ? <List density="compact">
          {items.map(item => 'folder' in item
            ? <ListItem key={item.key} label={item.folder.name} startContent={<HgiFolder size={16}/>} endContent={<Text type="supporting" color="secondary">›</Text>} isSelected={item.folder.name === nextName} onClick={() => openFolder(item.folder.path)}/>
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
        <Button label={t('documents.openDetail')} size="sm" onClick={() => { void navigate({ to: '/guides/$documentId', params: { documentId: preview.id } }); }}/>
      </HStack>
      <VStack gap={0} className={styles.previewBody}><Markdown headingLevelStart={3} density="compact">{preview.body}</Markdown></VStack>
    </VStack> : <VStack gap={3} className={styles.columnFiller} aria-hidden="true">
      <StateIllustration kind="empty" compact/>
      <Text type="supporting" color="secondary">{t('documents.choose')}</Text>
    </VStack>}
  </HStack>;
}

function DocumentPage({ doc, kind }: { doc: SpecDocument; kind: DocumentKind }) {
  return <VStack as="article" aria-label={t('documents.document', { label: documentLabel[kind] })} gap={0} className={styles.featureDetail}>
    <Link to={documentRoot[kind]} search={{ folder: folderOf(doc) || undefined, selected: doc.id }} className={styles.featureBack}>← {documentLabel[kind]}{folderOf(doc) ? ` / ${folderOf(doc)}` : ''}</Link>
    <VStack gap={3} className={styles.documentHeading}>
      <Heading level={1}>{doc.title}</Heading>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('common.path')}>{relativePath(doc)}</MetadataListItem>
        <MetadataListItem label="ID">{doc.id}</MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{doc.updatedAt ? <Timestamp value={doc.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
      <Link to="/" search={{ document: kind, q: doc.id }}>{t('documents.activity')}</Link>
    </VStack>
    <VStack gap={0} className={styles.documentBody}><Markdown headingLevelStart={2}>{doc.body}</Markdown></VStack>
  </VStack>;
}
