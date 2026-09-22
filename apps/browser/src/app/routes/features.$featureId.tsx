import { createFileRoute } from '@tanstack/react-router';
import { FeaturesPage } from '../../pages/features';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/features/$featureId')({validateSearch:validateRecordSearch,component:PageRoute});
function PageRoute(){const search=Route.useSearch();const {featureId}=Route.useParams();const navigate=Route.useNavigate();return <FeaturesPage featureId={featureId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
