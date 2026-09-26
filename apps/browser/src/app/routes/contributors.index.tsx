import { createFileRoute } from '@tanstack/react-router';
import { ContributorsPage, loadContributors } from '../../pages/contributors';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/contributors/')({validateSearch:validateRecordSearch,loader:({context,location})=>loadContributors(context.queryClient,undefined,validateRecordSearch(location.search)),component:PageRoute});
function PageRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();return <ContributorsPage search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
