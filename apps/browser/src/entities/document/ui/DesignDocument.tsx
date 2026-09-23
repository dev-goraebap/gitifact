import type { DesignSource, SpecFeature } from '@gitifact/contracts';
import { DocumentBody, DocumentLink, resolveDocumentLink, useDocumentIndex } from '../../../shared/ui/document';
import { RelatedList, RelatedItem } from '../../../shared/ui/related-list';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@tanstack/react-router';
import styles from './document.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** The documents a design drew on, one per row: a link (a document in the app, a URL in a new tab) with its note beneath. */
function DesignSources({ sources, path }: { sources: DesignSource[]; path: string }) {
  useLanguage();
  const index = useDocumentIndex();
  return <RelatedList label={t('design.sources')}>
    {sources.map((source, i) => {
      // A source names a document by ID; the server resolved its path when the document exists.
      const link = source.url ? resolveDocumentLink(source.url, path, index) : source.path ? resolveDocumentLink(relativeTo(path, source.path), path, index) : { kind: 'missing' as const, path: source.id ?? '' };
      const where = link.kind === 'external' ? hostOf(link.href) : link.kind === 'wiki' ? link.path.replace(/^\.gitifact\/wiki\//, '') : link.kind === 'missing' ? t('link.missing', { path: link.path }) : link.kind === 'outside' ? link.path : '';
      return <RelatedItem key={i} title={<DocumentLink link={link}>{source.title ?? source.id}</DocumentLink>}
        description={(source.note || where) && <HStack gap={2} wrap="wrap">{source.note && <Text type="supporting" color="secondary">{source.note}</Text>}{where && <Text type="supporting" color="secondary">{where}</Text>}</HStack>}/>;
    })}
  </RelatedList>;
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
 * requirements it explains come from its frontmatter and link to the requirements tab. The design the reader arrived
 * for is marked by its section on the design tab, the way the requirements tab marks the requirement itself.
 */
export function DesignDocument({design, path, features}: {design: {title: string; description?: string | undefined; body: string; sources?: DesignSource[] | undefined; requirements?: string[] | undefined}; path: string; features: SpecFeature[]}) {
  useLanguage();
  const requirements = design.requirements ?? [];
  return <VStack gap={4}>
    <Heading level={3}><mark className={styles.titleMark}>{design.title}</mark></Heading>
    {design.description && <Text type="supporting" color="secondary">{design.description}</Text>}
    {/* The frontmatter's relations, each kind in its own block with the documents one per row, above the prose. */}
    {(!!requirements.length || !!design.sources?.length) && <VStack gap={4} className={styles.relations}>
      {!!requirements.length && <RelatedList label={t('design.relatedRequirements')}>
        {requirements.map(id => {
          const feature = features.find(f => f.requirements.some(r => r.id === id));
          const requirement = feature?.requirements.find(r => r.id === id);
          return feature && requirement
            ? <RelatedItem key={id} title={<Link to="/features/$featureId" params={{ featureId: feature.id }} search={{ selected: id, tab: 'requirements' }} hash={id}>{requirement.title}</Link>} description={requirement.description}/>
            : <RelatedItem key={id} title={<Text color="secondary">{t('design.missingRequirement', { id })}</Text>}/>;
        })}
      </RelatedList>}
      {!!design.sources?.length && <DesignSources sources={design.sources} path={path}/>}
    </VStack>}
    <DocumentBody headingLevelStart={4} path={path}>{design.body}</DocumentBody>
  </VStack>;
}
