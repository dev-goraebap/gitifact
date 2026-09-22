import { RecordsPage, SearchFilter, ListSkeleton, type RecordSearch, type ChangeSearch } from '../../../widgets/records-page';
import { ContributorsView } from './ContributorsView';
import { PageHeader } from '../../../widgets/page-header';
import { t, useLanguage } from '../../../shared/i18n';

/** The people who wrote the records, as cards, or one person's part when `email` is set. */
export function ContributorsPage({ email, search, change }: { email?: string | undefined; search: RecordSearch; change: ChangeSearch }) {
  useLanguage();
  return <RecordsPage header={PageHeader} title={t('nav.contributors')} root="/contributors" hasTitle={!email} skeleton={<ListSkeleton/>}
    trail={checkout => { const person = email ? checkout.contributors.find(p => p.email === email) : undefined; return person ? [{ label: person.name }] : []; }}
    {...(email ? {} : { filters: () => <SearchFilter label={t('filters.search')} placeholder={t('filters.searchContributors')} value={search.q ?? ''} onChange={q => change({ ...search, q: q || undefined }, true)}/> })}>
    {({ checkout, session }) => <ContributorsView session={session} head={checkout.head} people={checkout.contributors} features={checkout.features} email={email} search={search}/>}
  </RecordsPage>;
}
