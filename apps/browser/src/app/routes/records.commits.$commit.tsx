import { createFileRoute } from '@tanstack/react-router';
import { CommitPage, loadCommit, type CommitSearch } from '../../pages/commit';
const tabs = ['records', 'documents', 'code'] as const;
const validateSearch = (input: Record<string, unknown>): CommitSearch => ({
  ...(tabs.includes(input.tab as typeof tabs[number]) ? { tab: input.tab as typeof tabs[number] } : {}),
  ...(typeof input.file === 'string' && input.file.length <= 1000 ? { file: input.file } : {}),
});
export const Route = createFileRoute('/records/commits/$commit')({validateSearch,loader:({context,params,location})=>loadCommit(context.queryClient,params.commit,validateSearch(location.search).tab,location.hash),component: PageRoute});
function PageRoute(){const {commit}=Route.useParams();const search=Route.useSearch();return <CommitPage commit={commit} search={search}/>;}
