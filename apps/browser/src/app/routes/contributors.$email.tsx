import { createFileRoute } from '@tanstack/react-router';
import { ContributorsPage } from '../../pages/contributors';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/contributors/$email')({validateSearch:validateRecordSearch,component:PageRoute});
function PageRoute(){const search=Route.useSearch();const {email}=Route.useParams();const navigate=Route.useNavigate();return <ContributorsPage email={email} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
