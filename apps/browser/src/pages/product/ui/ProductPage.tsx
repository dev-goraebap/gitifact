import { useQuery } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { ProductPanel } from './ProductPanel';
import type { ProductSearch } from '../model/search';
import { RequestState } from '../../../shared/ui/request-state';
export type ProductProps = {view:'history'|'features'|'contributors'|'product'|'guides';featureId?:string|undefined;email?:string|undefined;documentId?:string|undefined;productDocument?:boolean|undefined;search:ProductSearch;change:(s:ProductSearch,replace?:boolean)=>void};
export function ProductPage(props:ProductProps) {
 const session=useQuery(sessionOptions());
 if(!session.data||session.error)return <RequestState error={session.error} retry={()=>{void session.refetch();}}/>;
 return <ProductPanel key={session.data.sessionId} session={session.data} {...props}/>;
}
