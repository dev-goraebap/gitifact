import { createFileRoute, useParams } from '@tanstack/react-router';
import { ProductPage, validateProductSearch } from '../../pages/product';
// One mounted explorer for the folder view and every page, so the tree keeps what the reader expanded while moving between them.
export const Route = createFileRoute('/wiki')({validateSearch:validateProductSearch,component:WikiRoute});
function WikiRoute(){const search=Route.useSearch();const navigate=Route.useNavigate();const {documentId}=useParams({strict:false}) as {documentId?:string};return <ProductPage view="wiki" documentId={documentId} search={search} change={(next,replace)=>{void navigate({search:next,replace:replace??false});}}/>;}
