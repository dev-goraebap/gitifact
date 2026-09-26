import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage, loadOverview } from '../../pages/overview';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/dashboard/')({validateSearch:validateRecordSearch,loader:({context})=>loadOverview(context.queryClient),component:PageRoute});
function PageRoute(){return <OverviewPage/>;}
