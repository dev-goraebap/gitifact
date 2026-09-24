import type { AgentsFile } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { DocumentBody } from '../../../shared/ui/document';
import { InstructionMark } from './InstructionMark';
import styles from './instructions.module.css';
import { t, useLanguage } from '../../../shared/i18n';

// HTML comments such as the GITIFACT block markers are for tools; Markdown here never runs HTML, so they would show as text.
const withoutComments = (text: string) => text.replace(/<!--[\s\S]*?-->\n?/g, '');

/** AGENTS.md as a document: what every session loads, including the block `gitifact init` keeps and the project's own text. */
export function AgentsDetail({ agents }: { agents: AgentsFile }) {
  useLanguage();
  return <VStack as="article" gap={0} aria-label="AGENTS.md">
    <VStack gap={3} className={styles.heading}>
      <HStack gap={3} vAlign="center">
        <InstructionMark color="agents" title="AGENTS.md" size="lg"/>
        <Heading level={1}>AGENTS.md</Heading>
      </HStack>
      <Text color="secondary">{t('instructions.agentsDescription')}</Text>
      <MetadataList orientation="horizontal">
        <MetadataListItem label={t('common.path')}><Text type="code">{agents.path}</Text></MetadataListItem>
        <MetadataListItem label={t('common.recentChange')}>{agents.updatedAt ? <Timestamp value={agents.updatedAt} format="relative"/> : t('common.inProgress')}</MetadataListItem>
      </MetadataList>
    </VStack>
    <VStack gap={0} className={styles.agentsBody}><DocumentBody path={agents.path}>{withoutComments(agents.body)}</DocumentBody></VStack>
  </VStack>;
}
