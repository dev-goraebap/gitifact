import { createFileRoute } from '@tanstack/react-router';
import { WorkingPage, loadWorking, type WorkingSearch } from '../../pages/commit';
const tabs = ['records', 'documents'] as const;
const validateSearch = (input: Record<string, unknown>): WorkingSearch => (tabs.includes(input.tab as typeof tabs[number]) ? { tab: input.tab as typeof tabs[number] } : {});
export const Route = createFileRoute('/records/working')({validateSearch,loader:({context,location})=>loadWorking(context.queryClient,validateSearch(location.search).tab,location.hash),component: PageRoute});
function PageRoute(){const search=Route.useSearch();return <WorkingPage search={search}/>;}
