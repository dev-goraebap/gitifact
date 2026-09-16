import { createFileRoute } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
export const Route = createFileRoute('/guides/')({validateSearch:validateProductSearch,component:ProductRoute});
function ProductRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();return <ProductPage view="guides" search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
