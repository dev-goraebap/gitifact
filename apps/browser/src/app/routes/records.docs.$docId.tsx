import { createFileRoute } from '@tanstack/react-router';
import { DocumentHistoryPage, loadDocumentHistory } from '../../pages/document-history';
export const Route = createFileRoute('/records/docs/$docId')({loader:({context,params})=>loadDocumentHistory(context.queryClient,params.docId),component: PageRoute});
function PageRoute(){const {docId}=Route.useParams();return <DocumentHistoryPage docId={docId}/>;}
