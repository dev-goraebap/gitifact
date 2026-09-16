import type { SpecDocument } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { List, ListItem } from '@astryxdesign/core/List';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Table, pixel, proportional, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link, useNavigate } from '@tanstack/react-router';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import { HgiDocument } from '../../../shared/ui/icons/HgiDocument';
import type { ProductSearch } from '../model/search';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { StateIllustration } from '../../../shared/ui/page-state/StateIllustration';

// Only guides are browsed as a folder tree; the product description is a single page (ProductOverview).
export type DocumentKind = SpecDocument['kind'];
export const documentRoot = { product: '/product', guide: '/guides' } as const;
export const documentLabel = { product: '제품 개요', guide: '지침' } as const;
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
const matches = (doc: SpecDocument, q: string | undefined) => !q || (doc.title + ' ' + relativePath(doc) + ' ' + doc.id).toLowerCase().includes(q.toLowerCase());
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
  if (documentId && !selected) return <PageState kind="not-found" title="문서를 찾을 수 없습니다" description={`${documentId}는 현재 ${documentLabel[kind]} 문서에 없습니다. 옮겨졌거나 제거된 문서일 수 있습니다.`} actions={<Link to={documentRoot[kind]}>{documentLabel[kind]} 문서 목록으로</Link>}/>;
  if (selected) return <DocumentPage doc={selected} kind={kind} search={search}/>;
  if (!documents.length) return <PageState kind="empty" title={`${documentLabel[kind]} 문서가 아직 없습니다`} description="에이전트와 아키텍처·코드 규칙을 정리하면 이곳에서 볼 수 있습니다."/>;
  return search.view === 'list' ? <FolderTable documents={documents} kind={kind} search={search}/> : <ColumnBrowser documents={documents} kind={kind} search={search}/>;
}

/** Finder-style columns inside the shared reading column: each folder opens to the right; documents open their own page. */
function ColumnBrowser({ documents, kind, search }: { documents: SpecDocument[]; kind: DocumentKind; search: ProductSearch }) {
  const navigate = useNavigate();
  const chain = chainOf(tree(documents), search.folder ?? '');
  const open = (path: string) => { void navigate({ to: documentRoot[kind], search: { q: search.q, folder: path || undefined } }); };
  return <HStack gap={0} className={styles.columns} aria-label={`${documentLabel[kind]} 문서 탐색`}>
    {chain.map((node, index) => {
      const nextName = chain[index + 1]?.name;
      const items = [...node.folders.map(f => ({ key: 'd:' + f.path, folder: f })), ...node.documents.filter(d => matches(d, search.q)).map(d => ({ key: d.id, doc: d }))];
      return <VStack key={node.path || 'root'} gap={0} className={styles.browserColumn} aria-label={node.name || `${documentLabel[kind]} 문서`}>
        {items.length ? <List density="compact">
          {items.map(item => 'folder' in item
            ? <ListItem key={item.key} label={item.folder.name} startContent={<HgiFolder size={16}/>} endContent={<Text type="supporting" color="secondary">›</Text>} isSelected={item.folder.name === nextName} onClick={() => open(item.folder.path)}/>
            : <ListItem key={item.key} label={item.doc.title} description={relativePath(item.doc).split('/').pop()} startContent={<HgiDocument size={16}/>} href={`${documentRoot[kind]}/${encodeURIComponent(item.doc.id)}`}/>)}
        </List> : <Text type="supporting" color="secondary">{search.q ? '일치하는 문서가 없습니다.' : '비어 있는 폴더입니다.'}</Text>}
      </VStack>;
    })}
    <VStack gap={3} className={styles.columnFiller} aria-hidden="true">
      <StateIllustration kind="empty" compact/>
      <Text type="supporting" color="secondary">폴더를 열거나 문서를 고르세요.</Text>
    </VStack>
  </HStack>;
}

/** One folder at a time as a table: subfolders first, then the documents in it. A search flattens the whole tree. */
function FolderTable({ documents, kind, search }: { documents: SpecDocument[]; kind: DocumentKind; search: ProductSearch }) {
  const navigate = useNavigate();
  const chain = chainOf(tree(documents), search.folder ?? '');
  const node = chain[chain.length - 1]!;
  const searching = !!search.q;
  const open = (folder: string) => { void navigate({ to: documentRoot[kind], search: { q: search.q, view: 'list', folder: folder || undefined } }); };
  type Row = { id: string; kind: 'folder'; name: string; path: string; count: number } | { id: string; kind: 'doc'; doc: SpecDocument };
  const count = (n: Node): number => n.documents.length + n.folders.reduce((sum, f) => sum + count(f), 0);
  const rows: Row[] = searching
    ? documents.filter(d => matches(d, search.q)).sort((a, b) => a.path.localeCompare(b.path)).map(d => ({ id: d.id, kind: 'doc' as const, doc: d }))
    : [...node.folders.map(f => ({ id: 'd:' + f.path, kind: 'folder' as const, name: f.name, path: f.path, count: count(f) })), ...node.documents.map(d => ({ id: d.id, kind: 'doc' as const, doc: d }))];
  const activate = (row: Row) => { if (row.kind === 'folder') open(row.path); else void navigate({ to: '/guides/$documentId', params: { documentId: row.doc.id }, search: { q: search.q, view: 'list' } }); };
  const columns: TableColumn<Row>[] = [
    { key: 'name', header: '이름', width: proportional(1, { minWidth: 160 }), renderCell: row => row.kind === 'folder'
      ? <HStack gap={2} className={styles.entryLine}><HgiFolder size={16}/><Text weight="semibold">{row.name}</Text></HStack>
      : <HStack gap={2} className={styles.entryLine}><HgiDocument size={16}/><VStack gap={1}>
          <Link to="/guides/$documentId" params={{ documentId: row.doc.id }} search={{ q: search.q, view: 'list' }} className={styles.featureTitle}>{row.doc.title}</Link>
          <Text type="supporting" color="secondary" maxLines={1}>{searching ? relativePath(row.doc) : relativePath(row.doc).split('/').pop()}</Text>
        </VStack></HStack> },
    { key: 'id', header: 'ID', width: pixel(140), renderCell: row => <Text type="supporting" color="secondary">{row.kind === 'folder' ? `문서 ${row.count}개` : row.doc.id}</Text> },
    { key: 'updatedAt', header: '최근 변경', width: pixel(110), align: 'end', renderCell: row => row.kind === 'folder' ? <Text type="supporting" color="secondary">폴더</Text> : row.doc.updatedAt ? <Timestamp value={row.doc.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">작업 중</Text> },
  ];
  const interaction: TablePlugin<Row> = { transformBodyRow: (props, item) => ({ ...props, htmlProps: { ...props.htmlProps, tabIndex: 0,
    onClick: (event: { target: EventTarget | null }) => { if (!(event.target as HTMLElement | null)?.closest('a, button')) activate(item); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(item); } } } }) };
  return <VStack gap={3} className={styles.featureTable}>
    <HStack gap={2} wrap="wrap" className={styles.entryLine} aria-label="현재 폴더">
      {chain.map((n, index) => <HStack key={n.path || 'root'} gap={2} className={styles.entryLine}>
        {index > 0 && <Text type="supporting" color="secondary">/</Text>}
        {index < chain.length - 1 || searching ? <Link to={documentRoot[kind]} search={{ q: search.q, view: 'list', folder: n.path || undefined }} className={styles.crumb}>{n.name || documentLabel[kind]}</Link> : <Text type="supporting">{n.name || documentLabel[kind]}</Text>}
      </HStack>)}
      {searching && <Text type="supporting" color="secondary">· 전체 검색 결과 {rows.length}개</Text>}
    </HStack>
    {rows.length ? <Table data={rows} idKey="id" columns={columns} plugins={{ interaction }} density="compact" dividers="rows" hasHover textOverflow="truncate"/>
      : <PageState kind={searching ? 'search' : 'empty'} isCompact title={searching ? '일치하는 문서가 없습니다.' : '비어 있는 폴더입니다.'} {...(searching ? { description: '검색어를 바꿔 보세요.' } : {})}/>}
  </VStack>;
}

function DocumentPage({ doc, kind, search }: { doc: SpecDocument; kind: DocumentKind; search: ProductSearch }) {
  return <VStack as="article" aria-label={`${documentLabel[kind]} 문서`} gap={0} className={styles.featureDetail}>
    <Link to={documentRoot[kind]} search={{ q: search.q, view: search.view, folder: folderOf(doc) || undefined }} className={styles.featureBack}>← {documentLabel[kind]}{folderOf(doc) ? ` / ${folderOf(doc)}` : ''}</Link>
    <VStack gap={3} className={styles.documentHeading}>
      <Heading level={1}>{doc.title}</Heading>
      <MetadataList orientation="horizontal">
        <MetadataListItem label="경로">{relativePath(doc)}</MetadataListItem>
        <MetadataListItem label="ID">{doc.id}</MetadataListItem>
        <MetadataListItem label="최근 변경">{doc.updatedAt ? <Timestamp value={doc.updatedAt} format="relative"/> : '작업 중'}</MetadataListItem>
      </MetadataList>
      <Link to="/" search={{ document: kind, q: doc.id }}>이 문서의 활동 →</Link>
    </VStack>
    <VStack gap={0} className={styles.documentBody}><Markdown headingLevelStart={2}>{doc.body}</Markdown></VStack>
  </VStack>;
}
