import { createFileRoute } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
export const Route = createFileRoute('/product/document')({validateSearch:validateProductSearch,component:ProductRoute});
function ProductRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();return <ProductPage view="product" productDocument search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
