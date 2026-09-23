import { createFileRoute } from '@tanstack/react-router';
import { CommitPage } from '../../pages/commit';
export const Route = createFileRoute('/activity/$commit')({component: PageRoute});
function PageRoute(){const {commit}=Route.useParams();return <CommitPage commit={commit}/>;}
