import type { DesignSource, SpecFeature } from '@gitifact/contracts';
import { DocumentBody, DocumentLink, resolveDocumentLink, useDocumentIndex } from '../../../shared/ui/document';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';

/** Rows, not cards, for the documents a design drew on: each is a link (wiki page in the app, URL in a new tab) with its note beneath. */
function DesignSources({ sources, path }: { sources: DesignSource[]; path: string }) {
  const index = useDocumentIndex();
  return <VStack as="section" gap={2} aria-label={t('design.sources')} className={styles.designSources}>
    <Text type="supporting" color="secondary">{t('design.sources')}</Text>
    <List density="compact">
      {sources.map((source, i) => {
        const link = source.url ? resolveDocumentLink(source.url, path, index) : resolveDocumentLink(source.path ?? '', path, index);
        const where = link.kind === 'external' ? hostOf(link.href) : link.kind === 'wiki' ? link.path.replace(/^\.gitifact\/wiki\//, '') : link.kind === 'missing' ? t('link.missing', { path: link.path }) : link.kind === 'outside' ? link.path : '';
        return <ListItem key={i} label={<DocumentLink link={link}>{source.title}</DocumentLink>} description={<HStack gap={2} wrap="wrap">{source.note && <Text type="supporting" color="secondary">{source.note}</Text>}{where && <Text type="supporting" color="secondary">{where}</Text>}</HStack>}/>;
      })}
    </List>
  </VStack>;
}
const hostOf = (href: string) => { try { return new URL(href).hostname; } catch { return href; } };

/** `path` is the design file's repository path; its relative links and source paths start from that folder. */
export function DesignDocument({design, path, features}: {design: {title: string; body: string; sources?: DesignSource[] | undefined}; path: string; features: SpecFeature[]}) {
  let fence: {char: string; size: number} | undefined;
  const body = design.body.split('\n').map(line => {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; return line; }
    const ref = /^<!-- (?:gitifact|tryce)-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/.exec(line);
    if (!ref) return line;
    return '\n' + t('design.relatedRequirements') + ': ' + ref[1]!.split(', ').map(id => {
      const feature = features.find(f => f.requirements.some(r => r.id === id));
      return feature ? `[${id}](/features/${encodeURIComponent(feature.id)}?selected=${id}&tab=requirements#${id})` : t('design.missingRequirement', { id });
    }).join(', ') + '\n';
  }).join('\n');
  return <VStack gap={4}>
    <Heading level={3}>{design.title}</Heading>
    {!!design.sources?.length && <DesignSources sources={design.sources} path={path}/>}
    <DocumentBody headingLevelStart={4} path={path}>{body}</DocumentBody>
  </VStack>;
}
