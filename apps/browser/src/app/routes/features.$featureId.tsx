import { createFileRoute } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
export const Route = createFileRoute('/features/$featureId')({validateSearch:validateProductSearch,component:ProductRoute});
function ProductRoute(){const search=Route.useSearch();const {featureId}=Route.useParams();const navigate=Route.useNavigate();return <ProductPage view="features" featureId={featureId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
