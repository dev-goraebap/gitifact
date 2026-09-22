import { createFileRoute } from '@tanstack/react-router';
import { FeaturesPage } from '../../pages/features';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/features/')({validateSearch:validateRecordSearch,component:PageRoute});
function PageRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();return <FeaturesPage search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
