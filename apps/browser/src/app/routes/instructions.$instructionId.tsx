import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage } from '../../pages/instructions';
// `file` is the file of the instruction folder being read, relative to the folder; without it the page shows index.md.
const validateSearch = (input: Record<string, unknown>): { file?: string } => typeof input.file === 'string' && input.file.length <= 1000 ? { file: input.file } : {};
export const Route = createFileRoute('/instructions/$instructionId')({validateSearch,component:PageRoute});
function PageRoute(){const {instructionId}=Route.useParams();const {file}=Route.useSearch();return <InstructionsPage instructionId={instructionId} file={file}/>;}
