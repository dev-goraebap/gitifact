import { createFileRoute } from '@tanstack/react-router';
import { RecordPage } from '../../pages/commit';
export const Route = createFileRoute('/records/$recordId')({component: PageRoute});
function PageRoute(){const {recordId}=Route.useParams();return <RecordPage recordId={recordId}/>;}
