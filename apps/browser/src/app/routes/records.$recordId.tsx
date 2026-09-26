import { createFileRoute } from '@tanstack/react-router';
import { RecordPage, loadRecord } from '../../pages/commit';
export const Route = createFileRoute('/records/$recordId')({loader:({context,params,location})=>loadRecord(context.queryClient,params.recordId,location.hash),component: PageRoute});
function PageRoute(){const {recordId}=Route.useParams();return <RecordPage recordId={recordId}/>;}
