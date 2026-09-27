import { createFileRoute, redirect } from '@tanstack/react-router';
import { CommitPage, loadCommit, wholeCommitOf, type CommitSearch } from '../../pages/commit';
const tabs = ['records', 'documents', 'code'] as const;
const validateSearch = (input: Record<string, unknown>): CommitSearch => ({
  ...(tabs.includes(input.tab as typeof tabs[number]) ? { tab: input.tab as typeof tabs[number] } : {}),
  ...(typeof input.file === 'string' && input.file.length <= 1000 ? { file: input.file } : {}),
});
// An address with the start of a hash, as the search box and `git log --oneline` show it, moves to the whole hash.
const beforeLoad = async ({ context, params, search, location }: { context: { queryClient: import('@tanstack/react-query').QueryClient }; params: { commit: string }; search: CommitSearch; location: { hash: string } }) => {
  const whole = await wholeCommitOf(context.queryClient, params.commit);
  if (whole && whole !== params.commit) throw redirect({ to: '/records/commits/$commit', params: { commit: whole }, search, hash: location.hash, replace: true });
};
export const Route = createFileRoute('/records/commits/$commit')({validateSearch,beforeLoad,loader:({context,params,location})=>loadCommit(context.queryClient,params.commit,validateSearch(location.search).tab,location.hash),component: PageRoute});
function PageRoute(){const {commit}=Route.useParams();const search=Route.useSearch();return <CommitPage commit={commit} search={search}/>;}
