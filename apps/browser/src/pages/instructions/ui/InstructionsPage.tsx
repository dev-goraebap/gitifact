import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { BrowserSessionV3 } from '@gitifact/contracts';
import { RecordsPage, ListSkeleton } from '../../../widgets/records-page';
import { PageHeader } from '../../../widgets/page-header';
import { instructionsOptions } from '../../../entities/project';
import { PageState } from '../../../shared/ui/page-state';
import { RequestState } from '../../../shared/ui/request-state';
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
  return <RecordsPage header={PageHeader} title={t('nav.instructions')} description={t('pageDescription.instructions')} root="/instructions" hasTitle={!detail} skeleton={<ListSkeleton/>}
    trail={checkout => {
      if (agents) return [{ label: 'AGENTS.md' }];
      const instruction = instructionId ? checkout.index.instructions.find(s => s.id === instructionId) : undefined;
      return instruction ? [{ label: instruction.title }] : [];
    }}>
    {({ session }) => <Instructions session={session} instructionId={instructionId} agents={agents} file={file}/>}
  </RecordsPage>;
}

/** The instructions as the server sends them: every one with its files, few enough to read whole, and AGENTS.md. */
function Instructions({ session, instructionId, agents, file }: { session: BrowserSessionV3; instructionId?: string | undefined; agents?: boolean | undefined; file?: string | undefined }) {
  useLanguage();
  const query = useQuery(instructionsOptions(session));
  if (query.error) return <RequestState error={query.error} retry={() => { void query.refetch(); }}/>;
  if (!query.data) return <ListSkeleton/>;
  const { instructions, agents: agentsFile } = query.data;
  const notFound = (title: string, description: string) => <PageState kind="not-found" title={title} description={description} actions={<Link to="/instructions">{t('instructions.backToList')}</Link>}/>;
  if (agents) return agentsFile ? <AgentsDetail agents={agentsFile}/> : notFound(t('instructions.agentsMissingTitle'), t('instructions.agentsMissingDescription'));
  if (!instructionId) return <InstructionList instructions={instructions} agents={agentsFile}/>;
  const instruction = instructions.find(s => s.id === instructionId);
  return instruction ? <InstructionDetail instruction={instruction} color={instructionColorsOf(instructions).get(instruction.id)} file={file} session={session}/>
    : notFound(t('instructions.notFoundTitle'), t('instructions.notFoundDescription', { id: instructionId }));
}
