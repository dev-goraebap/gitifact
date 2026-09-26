import { RecordsPage } from '../../../widgets/records-page';
import { ProductOverview } from './ProductOverview';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** The dashboard: the project, its size, two charts and the newest reasons. It carries its own heading. */
export function OverviewPage() {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.product')} root="/dashboard" hasTitle={false}>
    {({ checkout, session }) => <ProductOverview session={session} head={checkout.head} features={checkout.index.features} instructions={checkout.index.instructions.length} contributors={checkout.index.people.length} working={checkout.working}/>}
  </RecordsPage>;
}
