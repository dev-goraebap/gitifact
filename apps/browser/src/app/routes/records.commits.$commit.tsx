import { createFileRoute } from '@tanstack/react-router';
import { CommitPage } from '../../pages/commit';
export const Route = createFileRoute('/records/commits/$commit')({component: PageRoute});
function PageRoute(){const {commit}=Route.useParams();return <CommitPage commit={commit}/>;}
