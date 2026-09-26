import { createFileRoute } from '@tanstack/react-router';
import { FeaturesPage, loadFeatures } from '../../pages/features';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/features/$featureId')({validateSearch:validateRecordSearch,
  loader:({context,params,location})=>loadFeatures(context.queryClient,params.featureId,validateRecordSearch(location.search)),component:PageRoute});
function PageRoute(){const search=Route.useSearch();const {featureId}=Route.useParams();const navigate=Route.useNavigate();return <FeaturesPage featureId={featureId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
