import type { DesignSource, SpecFeature } from '@gitifact/contracts';
import { DocumentBody, DocumentLink, resolveDocumentLink, useDocumentIndex } from '../../../shared/ui/document';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Link } from '@tanstack/react-router';
import styles from './product.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Rows, not cards, for the documents a design drew on: each is a link (a document in the app, a URL in a new tab) with its note beneath. */
function DesignSources({ sources, path }: { sources: DesignSource[]; path: string }) {
  useLanguage();
  const index = useDocumentIndex();
  return <VStack as="section" gap={2} aria-label={t('design.sources')} className={styles.designSources}>
    <Text type="supporting" color="secondary">{t('design.sources')}</Text>
    <List density="compact">
      {sources.map((source, i) => {
        // A source names a document by ID; the server resolved its path when the document exists.
        const link = source.url ? resolveDocumentLink(source.url, path, index) : source.path ? resolveDocumentLink(relativeTo(path, source.path), path, index) : { kind: 'missing' as const, path: source.id ?? '' };
        const where = link.kind === 'external' ? hostOf(link.href) : link.kind === 'wiki' ? link.path.replace(/^\.gitifact\/wiki\//, '') : link.kind === 'missing' ? t('link.missing', { path: link.path }) : link.kind === 'outside' ? link.path : '';
        return <ListItem key={i} label={<DocumentLink link={link}>{source.title ?? source.id}</DocumentLink>} description={<HStack gap={2} wrap="wrap">{source.note && <Text type="supporting" color="secondary">{source.note}</Text>}{where && <Text type="supporting" color="secondary">{where}</Text>}</HStack>}/>;
      })}
    </List>
  </VStack>;
}
const hostOf = (href: string) => { try { return new URL(href).hostname; } catch { return href; } };
/** A repository path written relative to the folder of `from`, the form links in documents take. */
function relativeTo(from: string, to: string) {
  const a = from.split('/').slice(0, -1); const b = to.split('/');
  let common = 0; while (common < a.length && common < b.length - 1 && a[common] === b[common]) common++;
  return [...Array(a.length - common).fill('..'), ...b.slice(common)].join('/');
}

/**
 * One design document. `path` is its repository path; relative links and sources start from that folder. The
 * requirements it explains come from its frontmatter and link to the requirements tab. `isCurrent` marks the design
 * the reader arrived for, the way the requirements tab marks the requirement itself.
 */
export function DesignDocument({design, path, features, isCurrent}: {design: {title: string; description?: string | undefined; body: string; sources?: DesignSource[] | undefined; requirements?: string[] | undefined}; path: string; features: SpecFeature[]; isCurrent?: boolean | undefined}) {
  useLanguage();
  const requirements = design.requirements ?? [];
  return <VStack gap={4}>
    <Heading level={3}>{isCurrent ? <mark className={styles.currentMark}>{design.title}</mark> : design.title}</Heading>
    {design.description && <Text type="supporting" color="secondary">{design.description}</Text>}
    {!!requirements.length && <HStack gap={2} wrap="wrap">
      <Text type="supporting" color="secondary">{t('design.relatedRequirements')}:</Text>
      {requirements.map(id => {
        const feature = features.find(f => f.requirements.some(r => r.id === id));
        const title = feature?.requirements.find(r => r.id === id)?.title;
        return feature
          ? <Link key={id} to="/features/$featureId" params={{ featureId: feature.id }} search={{ selected: id, tab: 'requirements' }} hash={id}>{title ?? id}</Link>
          : <Text key={id} type="supporting" color="secondary">{t('design.missingRequirement', { id })}</Text>;
      })}
    </HStack>}
    {!!design.sources?.length && <DesignSources sources={design.sources} path={path}/>}
    <DocumentBody headingLevelStart={4} path={path}>{design.body}</DocumentBody>
  </VStack>;
}
