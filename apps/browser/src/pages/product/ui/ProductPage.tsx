import { useQuery } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { ProductPanel } from './ProductPanel';
import type { ProductProps } from '../model/search';
import { RequestState } from '../../../shared/ui/request-state';
export function ProductPage(props:ProductProps) {
 const session=useQuery(sessionOptions());
 if(!session.data||session.error)return <RequestState error={session.error} retry={()=>{void session.refetch();}}/>;
 return <ProductPanel key={session.data.sessionId} session={session.data} {...props}/>;
}
