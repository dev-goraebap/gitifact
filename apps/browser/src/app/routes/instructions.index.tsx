import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage } from '../../pages/instructions';
export const Route = createFileRoute('/instructions/')({component:()=><InstructionsPage/>});
