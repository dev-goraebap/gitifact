import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage } from '../../pages/instructions';
// AGENTS.md has a fixed address beside the instructions, which are addressed by their I- IDs.
export const Route = createFileRoute('/instructions/agents')({component:()=><InstructionsPage agents/>});
