import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage, loadInstructions } from '../../pages/instructions';
// AGENTS.md has a fixed address beside the instructions, which are addressed by their I- IDs.
export const Route = createFileRoute('/instructions/agents')({loader:({context})=>loadInstructions(context.queryClient,{agents:true}),component:()=><InstructionsPage agents/>});
