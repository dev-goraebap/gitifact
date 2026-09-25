import { createFileRoute } from '@tanstack/react-router';
import { WorkingPage, type WorkingSearch } from '../../pages/commit';
const tabs = ['records', 'documents'] as const;
const validateSearch = (input: Record<string, unknown>): WorkingSearch => (tabs.includes(input.tab as typeof tabs[number]) ? { tab: input.tab as typeof tabs[number] } : {});
export const Route = createFileRoute('/records/working')({validateSearch,component: PageRoute});
function PageRoute(){const search=Route.useSearch();return <WorkingPage search={search}/>;}
