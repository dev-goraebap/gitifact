import type { SpecEvent, SpecFeature, SpecSnapshot } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { DesignDocument } from '../../../entities/document';
import { ChangeDiff } from './ChangeDiff';
import styles from './commit.module.css';
import { DocumentBody } from '../../../shared/ui/document';
import { t, useLanguage } from '../../../shared/i18n';

export type Change = { event: SpecEvent; before: SpecSnapshot | null; after: SpecSnapshot | null };

/**
 * What a changed document shows under its title: where it is, links to it now and to its history, then its
 * differences — or its text, when it was added or deleted.
 */
export function ChangeBody({ change: { event, before, after }, features, head }: { change: Change; features: SpecFeature[]; head: string | null }) {
  useLanguage();
  const spec = after ?? before;
  const body = (s: SpecSnapshot) => event.kind === 'design'
    ? <DesignDocument design={s} path={s.path} features={features}/>
    : <DocumentBody headingLevelStart={4} path={s.path}>{s.body}</DocumentBody>;
  return <VStack gap={4}>
    <HStack gap={3} wrap="wrap" className={styles.changePlace}>
      <Text type="supporting" color="secondary">{event.id}</Text>
      <Text type="supporting" color="secondary">{spec?.path}</Text>
      {/* A wiki page from before the wiki left the browser has no current page to open. */}
      {event.kind === 'wiki' ? null
        : event.kind === 'instruction'
        ? after && <Link to="/instructions/$instructionId" params={{ instructionId: event.id }}>{t('event.currentInstruction')}</Link>
        : <Link to="/features/$featureId" params={{ featureId: spec?.specId ?? '' }}
          search={{ ...(event.kind === 'feature' ? {} : { selected: event.id, tab: event.kind === 'design' ? 'design' : 'requirements' }) }}
          {...(event.kind === 'feature' ? {} : { hash: event.id })}>{t('event.currentFeature')}</Link>}
      {head && <Link to="/records" search={{ q: event.id }}>{t('commit.documentHistory')}</Link>}
    </HStack>
    {before && after ? <ChangeDiff before={before} after={after} features={features}/>
      : after ? body(after) : before ? body(before) : <Text color="secondary">{t('event.noContent')}</Text>}
  </VStack>;
}
