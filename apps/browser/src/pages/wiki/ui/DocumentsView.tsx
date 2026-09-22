import { useEffect, useRef } from 'react';
import type { SpecDocument } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { List, ListItem } from '@astryxdesign/core/List';
import { TreeList, type TreeListItemData } from '@astryxdesign/core/TreeList';
import { Breadcrumbs, BreadcrumbItem } from '@astryxdesign/core/Breadcrumbs';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link, useNavigate } from '@tanstack/react-router';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import { HgiDocument } from '../../../shared/ui/icons/HgiDocument';
import type { RecordSearch } from '../../../widgets/records-page';
import styles from './wiki.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { DocumentBody, wikiEntryPath } from '../../../shared/ui/document';
import { t, useLanguage } from '../../../shared/i18n';

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
/** The folder named by `folder`, or undefined when no such folder exists. */
function folderAt(root: Node, folder: string): Node | undefined {
  let node: Node | undefined = root;
  for (const part of folder.split('/').filter(Boolean)) node = node?.folders.find(f => f.name === part);
  return node;
}
const fileName = (doc: SpecDocument) => relativePath(doc).split('/').pop()!;

/**
 * A repository-style explorer: the whole wiki as a tree on the left, and on the right either the chosen folder's
 * contents or the chosen page. Folders live in the `folder` search param, pages in the `/wiki/$documentId` path.
 */
export function DocumentsView({ documents, documentId, search }: { documents: SpecDocument[]; documentId?: string | undefined; search: RecordSearch; change: (s: RecordSearch) => void }) {
  useLanguage();
  const navigate = useNavigate();
  // A new folder or page starts at the top instead of where the previous one was left.
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The content card scrolls, not the pane: find that scroller and return it to the top. The router's scroll
    // restoration writes the previous offset back during the same frame, so the reset waits for the frame after it.
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      for (let el = pane.current?.parentElement; el; el = el.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(el).overflowY)) { el.scrollTop = 0; break; }
      }
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [documentId, search.folder]);
  if (!documents.length && !documentId) return <PageState kind="empty" title={t('documents.emptyTitle')} description={t('documents.emptyDescription')}/>;
  const root = tree(documents);
  // A wiki that holds only its operating policy opens straight onto it instead of a one-row list.
  const onlyPolicy = !documentId && !search.folder && documents.length === 1 && documents[0]!.path === wikiEntryPath ? documents[0] : undefined;
  const selected = documentId ? documents.find(d => d.id === documentId) : onlyPolicy;
  const folder = selected ? folderOf(selected) : folderAt(root, search.folder ?? '') ? search.folder ?? '' : '';
  const openFolder = (path: string) => { void navigate({ to: '/wiki', search: { folder: path || undefined } }); };
  const openDocument = (doc: SpecDocument) => { void navigate({ to: '/wiki/$documentId', params: { documentId: doc.id } }); };
  const plain = (e: React.MouseEvent) => !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
  // Folders on the way to the current location start open; the tree keeps what the reader toggles after that.
  const items = (node: Node): TreeListItemData[] => [
    ...node.folders.map(f => ({ id: 'd:' + f.path, label: f.name, startContent: <span className={styles.explorerFolder}><HgiFolder size={16}/></span>, children: items(f),
      isExpanded: folder === f.path || folder.startsWith(f.path + '/'), isSelected: !selected && folder === f.path, onClick: () => openFolder(f.path) })),
    ...node.documents.map(d => ({ id: d.id, label: fileName(d), startContent: <span className={styles.explorerFile}><HgiDocument size={16}/></span>, href: `/wiki/${encodeURIComponent(d.id)}`, isSelected: d.id === selected?.id,
      onClick: (e: React.MouseEvent) => { if (plain(e)) { e.preventDefault(); openDocument(d); } } })),
  ];
  const crumbs = folder.split('/').filter(Boolean);
  const crumbClick = (path: string) => (e: React.MouseEvent) => { if (plain(e)) { e.preventDefault(); openFolder(path); } };
  return <HStack gap={0} className={styles.explorer}>
    <VStack as="nav" gap={0} className={styles.explorerTree} aria-label={t('documents.tree')}>
      <TreeList density="balanced" aria-label={t('documents.tree')} items={items(root)}/>
    </VStack>
    <div className={styles.explorerPane} ref={pane}>
      <Breadcrumbs label={t('documents.path')} className={styles.explorerCrumbs}>
        <BreadcrumbItem href="/wiki" onClick={crumbClick('')} isCurrent={!crumbs.length && !selected && !documentId}>wiki</BreadcrumbItem>
        {crumbs.map((part, index) => { const path = crumbs.slice(0, index + 1).join('/'); return <BreadcrumbItem key={path} href={`/wiki?folder=${encodeURIComponent(path)}`} onClick={crumbClick(path)} isCurrent={!selected && index === crumbs.length - 1}>{part}</BreadcrumbItem>; })}
        {selected && <BreadcrumbItem isCurrent>{fileName(selected)}</BreadcrumbItem>}
      </Breadcrumbs>
      {documentId && !selected ? <PageState kind="not-found" title={t('documents.notFoundTitle')} description={t('documents.notFoundDescription', { id: documentId })} actions={<Link to="/wiki">{t('documents.backToList')}</Link>}/>
        : selected ? <DocumentPage doc={selected}/>
        : <FolderListing node={folderAt(root, folder)!} openFolder={openFolder} openDocument={openDocument}/>}
    </div>
  </HStack>;
}

/** The contents of one folder, folders first; a README.md in it is shown below the list, as a repository host does. */
function FolderListing({ node, openFolder, openDocument }: { node: Node; openFolder: (path: string) => void; openDocument: (doc: SpecDocument) => void }) {
  useLanguage();
  const readme = node.documents.find(d => fileName(d) === 'README.md');
  return <VStack gap={5} className={styles.explorerBody}>
    {node.folders.length + node.documents.length ? <VStack gap={0} className={styles.explorerList}><List density="compact" aria-label={t('documents.browse')}>
      {node.folders.map(f => <ListItem key={'d:' + f.path} label={f.name} description={t('documents.folderCount', { count: countDocuments(f) })} startContent={<span className={styles.explorerFolder}><HgiFolder size={16}/></span>} onClick={() => openFolder(f.path)}/>)}
      {node.documents.map(d => <ListItem key={d.id} label={fileName(d)} description={d.title} startContent={<span className={styles.explorerFile}><HgiDocument size={16}/></span>}
        endContent={<Text type="supporting" color="secondary">{d.updatedAt ? <Timestamp value={d.updatedAt} format="relative"/> : t('common.inProgress')}</Text>} onClick={() => openDocument(d)}/>)}
    </List></VStack> : <Text type="supporting" color="secondary">{t('documents.emptyFolder')}</Text>}
    {readme && <VStack as="section" gap={3} aria-label={readme.title} className={styles.explorerReadme}>
      <Heading level={2}>{readme.title}</Heading>
      <DocumentBody headingLevelStart={3} path={readme.path}>{bodyOf(readme)}</DocumentBody>
    </VStack>}
  </VStack>;
}

function DocumentPage({ doc }: { doc: SpecDocument }) {
  useLanguage();
  return <VStack as="article" aria-label={t('documents.document')} gap={0} className={styles.explorerBody}>
    <VStack gap={3} className={styles.documentHeading}>
      <Heading level={1}>{doc.title}</Heading>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('common.path')}>{relativePath(doc)}</MetadataListItem>
        <MetadataListItem label="ID">{doc.id}</MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{doc.updatedAt ? <Timestamp value={doc.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
      <Link to="/activity" search={{ document: 'wiki', q: doc.id }}>{t('documents.activity')}</Link>
    </VStack>
    <VStack gap={0} className={styles.documentBody}><DocumentBody path={doc.path}>{bodyOf(doc)}</DocumentBody></VStack>
  </VStack>;
}
