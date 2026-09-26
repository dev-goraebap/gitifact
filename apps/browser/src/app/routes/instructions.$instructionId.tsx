import { createFileRoute } from '@tanstack/react-router';
import { InstructionsPage, loadInstructions } from '../../pages/instructions';
// `file` is the file of the instruction folder being read, relative to the folder; without it the page shows index.md.
const validateSearch = (input: Record<string, unknown>): { file?: string } => typeof input.file === 'string' && input.file.length <= 1000 ? { file: input.file } : {};
export const Route = createFileRoute('/instructions/$instructionId')({validateSearch,
  // Only the file a visit opens on is primed: choosing another file is read in place, not a move.
  loader:({context,params,location})=>loadInstructions(context.queryClient,{instructionId:params.instructionId,file:validateSearch(location.search).file}),component:PageRoute});
function PageRoute(){const {instructionId}=Route.useParams();const {file}=Route.useSearch();return <InstructionsPage instructionId={instructionId} file={file}/>;}
