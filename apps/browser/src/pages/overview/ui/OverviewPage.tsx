import { RecordsPage } from '../../../widgets/records-page';
import { ProductOverview } from './ProductOverview';
import { OverviewSkeleton } from './OverviewSkeleton';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** The dashboard: the project, its size, two charts and the newest reasons. It carries its own heading. */
export function OverviewPage() {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.product')} root="/dashboard" hasTitle={false} skeleton={<OverviewSkeleton/>}>
    {({ checkout, session }) => <ProductOverview session={session} head={checkout.head} features={checkout.features} instructions={checkout.instructions.length} contributors={checkout.contributors} working={checkout.working}/>}
  </RecordsPage>;
}
