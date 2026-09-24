import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '../../pages/overview';
import { validateRecordSearch } from '../../widgets/records-page';
export const Route = createFileRoute('/dashboard/')({validateSearch:validateRecordSearch,component:PageRoute});
function PageRoute(){return <OverviewPage/>;}
