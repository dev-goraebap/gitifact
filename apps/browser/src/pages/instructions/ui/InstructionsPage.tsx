import { Link } from '@tanstack/react-router';
import { RecordsPage, ListSkeleton } from '../../../widgets/records-page';
import { PageHeader } from '../../../widgets/page-header';
import { PageState } from '../../../shared/ui/page-state';
import { InstructionList } from './InstructionList';
import { InstructionDetail } from './InstructionDetail';
import { AgentsDetail } from './AgentsDetail';
import { instructionColorsOf } from '../model/instruction-color';
import { t, useLanguage } from '../../../shared/i18n';

/**
 * The project's instructions: AGENTS.md and the instructions it points at as a list, AGENTS.md itself when `agents`
 * is set, or one instruction and the file of its folder being read when `instructionId` is set.
 */
export function InstructionsPage({ instructionId, agents, file }: { instructionId?: string | undefined; agents?: boolean; file?: string | undefined }) {
  useLanguage();
  const detail = agents || !!instructionId;
  return <RecordsPage header={PageHeader} title={t('nav.instructions')} root="/instructions" hasTitle={!detail} skeleton={<ListSkeleton/>}
    trail={checkout => {
      if (agents) return checkout.agents ? [{ label: 'AGENTS.md' }] : [];
      const instruction = instructionId ? checkout.instructions.find(s => s.id === instructionId) : undefined;
      return instruction ? [{ label: instruction.title }] : [];
    }}>
    {({ checkout, session }) => {
      const notFound = (title: string, description: string) => <PageState kind="not-found" title={title} description={description} actions={<Link to="/instructions">{t('instructions.backToList')}</Link>}/>;
      if (agents) return checkout.agents ? <AgentsDetail agents={checkout.agents}/> : notFound(t('instructions.agentsMissingTitle'), t('instructions.agentsMissingDescription'));
      if (!instructionId) return <InstructionList instructions={checkout.instructions} agents={checkout.agents}/>;
      const instruction = checkout.instructions.find(s => s.id === instructionId);
      return instruction ? <InstructionDetail instruction={instruction} color={instructionColorsOf(checkout.instructions).get(instruction.id)} file={file} features={checkout.features} session={session}/>
        : notFound(t('instructions.notFoundTitle'), t('instructions.notFoundDescription', { id: instructionId }));
    }}
  </RecordsPage>;
}
