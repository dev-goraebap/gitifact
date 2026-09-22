import { createFileRoute, useParams } from '@tanstack/react-router';
import { WikiPage } from '../../pages/wiki';
import { validateRecordSearch } from '../../widgets/records-page';
// One mounted explorer for the folder view and every page, so the tree keeps what the reader expanded while moving between them.
export const Route = createFileRoute('/wiki')({validateSearch:validateRecordSearch,component:WikiRoute});
function WikiRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();const {documentId}=useParams({strict:false}) as {documentId?:string};return <WikiPage documentId={documentId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
