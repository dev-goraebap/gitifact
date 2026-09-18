import { createFileRoute } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
export const Route = createFileRoute('/wiki/$documentId')({validateSearch:validateProductSearch,component:ProductRoute});
function ProductRoute(){const search=Route.useSearch();const {documentId}=Route.useParams();const navigate=Route.useNavigate();return <ProductPage view="wiki" documentId={documentId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
