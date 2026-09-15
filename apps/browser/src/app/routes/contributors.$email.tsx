import { createFileRoute } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
export const Route = createFileRoute('/contributors/$email')({validateSearch:validateProductSearch,component:ProductRoute});
function ProductRoute(){const search=Route.useSearch();const {email}=Route.useParams();const navigate=Route.useNavigate();return <ProductPage view="contributors" email={email} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
