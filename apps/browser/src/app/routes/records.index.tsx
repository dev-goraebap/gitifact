import { createFileRoute } from '@tanstack/react-router';
import { ActivityPage, loadRecords } from '../../pages/activity';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/records/')({validateSearch:validateRecordSearch,loader:({context,location})=>loadRecords(context.queryClient,validateRecordSearch(location.search)),component:PageRoute});
function PageRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();return <ActivityPage search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
