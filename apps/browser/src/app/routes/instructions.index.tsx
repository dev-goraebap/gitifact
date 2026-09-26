import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage, loadInstructions } from '../../pages/instructions';
export const Route = createFileRoute('/instructions/')({loader:({context})=>loadInstructions(context.queryClient),component:()=><InstructionsPage/>});
