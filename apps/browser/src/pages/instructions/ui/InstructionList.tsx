import type { AgentsFile, SpecInstruction } from '@gitifact/contracts';
import type { ReactNode } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import type { DocumentState } from '@gitifact/contracts';
import { StateToken } from '../../../entities/document';
import { PageState } from '../../../shared/ui/page-state';
import { RouterLink } from '../../../shared/ui/router-link/RouterLink';
import { InstructionMark } from './InstructionMark';
import { instructionColorsOf, type InstructionColor } from '../model/instruction-color';
import styles from './instructions.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * AGENTS.md, which every session loads, then the instructions it points agents at for one kind of work, in the order
 * the server gives (by name). Rows are links of their own because the title and the folder name share a line, which
 * ListItem does not allow.
 */
export function InstructionList({ instructions, agents }: { instructions: SpecInstruction[]; agents: AgentsFile | null }) {
  useLanguage();
  if (!instructions.length && !agents) return <PageState kind="empty" title={t('instructions.emptyTitle')} description={t('instructions.emptyDescription')}/>;
  const colors = instructionColorsOf(instructions);
  return <VStack gap={0}>
    {agents && <>
      <Text type="supporting" color="secondary" className={styles.groupLabel}>{t('instructions.always')}</Text>
      <VStack as="ul" gap={0} aria-label={t('instructions.always')} className={styles.rows}>
        <Row href="/instructions/agents" color="agents" title="AGENTS.md" description={t('instructions.agentsDescription')}/>
      </VStack>
    </>}
    <Text type="supporting" color="secondary" className={styles.groupLabel}>{t('instructions.byWork', { count: instructions.length })}</Text>
    {instructions.length ? <VStack as="ul" gap={0} aria-label={t('instructions.byWorkLabel')} className={styles.rows}>
      {instructions.map(instruction => <Row key={instruction.id} href={`/instructions/${encodeURIComponent(instruction.id)}`}
        color={colors.get(instruction.id)} title={instruction.title} name={instruction.name} description={instruction.description} state={instruction.state}/>)}
    </VStack> : <Text type="supporting" color="secondary">{t('instructions.noneYet')}</Text>}
  </VStack>;
}

function Row({ href, color, title, name, description, state = 'committed' }: { href: string; color: InstructionColor | 'agents' | undefined; title: string; name?: string; description: ReactNode; state?: DocumentState }) {
  return <li data-state={state === 'committed' ? undefined : state}>
    <RouterLink href={href} className={styles.row}>
      <InstructionMark color={color} title={title} size="lg"/>
      <VStack gap={0.5} className={styles.rowText}>
        <HStack gap={2} className={styles.rowHead}>
          <Text weight="semibold" className={styles.rowTitle} data-state-title>{title}</Text>
          <StateToken state={state}/>
          {name && name !== title && <Text type="supporting" color="secondary" className={styles.clip}>{name}</Text>}
        </HStack>
        <Text type="supporting" color="secondary" className={styles.clip}>{description}</Text>
      </VStack>
    </RouterLink>
  </li>;
}
