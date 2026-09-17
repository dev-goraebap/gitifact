import type { SpecDocument, SpecEvent, SpecFeature, BrowserSpecsV1 } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Grid } from '@astryxdesign/core/Grid';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { Person } from './Person';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';
import { t } from '../../../shared/i18n';

type Contributor = BrowserSpecsV1['contributors'][number];
type ChangeType = SpecEvent['types'][number];

/** Relative image links in PRODUCT.md point at files beside it; the server exposes those by file name only. */
export function productImageSources(body: string) {
  return body.replace(/(!\[[^\]]*\]\()(?:\.\/)?([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|svg|webp))(\s*(?:"[^"]*")?\))/gi, '$1/api/v1/product/assets/$2$3');
}
/** A banner image as the very first block duplicates the wordmark already in the side nav; the dashboard drops it and keeps every other image. */
export function withoutLeadingBanner(body: string) {
  return body.replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*\n+/, '');
}

// Categorical hues in a fixed order validated for adjacent-pair CVD separation (blue → orange → purple → green); gray closes a tail.
const series = ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-purple, #6B1EFD)', 'var(--color-data-categorical-green, #0B991F)'] as const;
const tail = 'var(--color-data-neutral, #8494A3)';
const changeNames: Record<ChangeType, string> = { created: t('change.created'), modified: t('change.modified'), moved: t('change.moved'), deleted: t('change.deleted') };
const changeOrder: ChangeType[] = ['created', 'modified', 'moved', 'deleted'];
const kindNames: Record<NonNullable<SpecEvent['kind']>, string> = { requirement: t('kind.requirement'), design: t('kind.design'), product: t('kind.product'), guide: t('kind.guide') };

type Segment = { label: string; value: number; color: string };

/** One horizontal part-to-whole bar; each segment carries its own title for hover and a 2px surface gap from its neighbour. */
function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const shown = segments.filter(s => s.value > 0);
  if (!total) return <Text type="supporting" color="secondary">{t('overview.noData')}</Text>;
  let offset = 0;
  return <VStack gap={3}>
    <svg role="img" aria-label={label} className={styles.stackedBar} width="100%" height="24">
      {shown.map(s => {
        const x = (offset / total) * 100; const width = (s.value / total) * 100; offset += s.value;
        return <rect key={s.label} x={`${x}%`} y="0" width={`${width}%`} height="24" fill={s.color} className={styles.stackedSegment}><title>{`${s.label} ${s.value}`}</title></rect>;
      })}
    </svg>
    <HStack as="ul" gap={4} wrap="wrap" className={styles.legend} aria-label={t('overview.legend', { label })}>
      {segments.map(s => <HStack as="li" key={s.label} gap={2} className={styles.legendItem}>
        <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2" fill={s.color}/></svg>
        <Text type="supporting">{s.label}</Text>
        <Text type="supporting" color="secondary">{s.value} · {Math.round((s.value / total) * 100)}%</Text>
      </HStack>)}
    </HStack>
  </VStack>;
}

function Stat({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return <Card padding={4}><VStack gap={1}>
    <Text type="supporting" color="secondary">{label}</Text>
    <Heading level={2}>{value}</Heading>
    {detail && <Text type="supporting" color="secondary">{detail}</Text>}
  </VStack></Card>;
}

/** The product page as a dashboard: headline counts and charts drawn from the loaded specs answer, then the PRODUCT.md text as written. */
export function ProductOverview({ product, features, documents, events, contributors, working }: { product: SpecDocument | undefined; features: SpecFeature[]; documents: SpecDocument[]; events: SpecEvent[]; contributors: Contributor[]; working: boolean }) {
  const requirements = features.reduce((sum, f) => sum + f.requirements.length, 0);
  const designed = features.filter(f => f.design).length;
  const guides = documents.filter(d => d.kind === 'guide').length;
  const ranked = [...features].sort((a, b) => b.requirements.length - a.requirements.length || a.title.localeCompare(b.title));
  const mostRequirements = Math.max(1, ...features.map(f => f.requirements.length));
  const changes: Segment[] = changeOrder.map((type, i) => ({ label: changeNames[type], value: events.filter(e => e.types.includes(type)).length, color: series[i]! }));
  const byCommits = [...contributors].sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const commitShare: Segment[] = [...byCommits.slice(0, 3).map((p, i) => ({ label: p.name, value: p.commits, color: series[i]! })), ...(byCommits.length > 3 ? [{ label: t('overview.otherContributors', { count: byCommits.length - 3 }), value: byCommits.slice(3).reduce((sum, p) => sum + p.commits, 0), color: tail }] : [])];
  const recent = events.slice(0, 5);
  const specOf = (e: SpecEvent) => e.kind === 'product' || e.kind === 'guide' ? documents.find(d => d.id === e.id) : features.find(f => f.id === e.id || f.requirements.some(r => r.id === e.id));
  return <VStack as="article" aria-label={t('nav.product')} gap={6} className={styles.dashboard}>
    <VStack gap={2} className={styles.dashboardHead}>
      <Heading level={1}>{product?.title ?? t('nav.product')}</Heading>
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        {product && <Text type="supporting" color="secondary">{product.id}</Text>}
        {product && (product.updatedAt ? <Timestamp value={product.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">{t('common.inProgress')}</Text>)}
        {working && <Token label={t('overview.uncommittedToken')} color="yellow" size="sm"/>}
        {product && <Link to="/product/document">{t('overview.openDocument')}</Link>}
        <Link to="/" search={{ document: 'product' }}>{t('overview.productHistory')}</Link>
      </HStack>
    </VStack>

    <Grid columns={{ minWidth: 150, repeat: 'fit', max: 5 }} gap={3} aria-label={t('overview.summary')}>
      <Stat label={t('overview.stat.features')} value={features.length} detail={working ? t('overview.stat.includesWorking') : t('overview.stat.committedOnly')}/>
      <Stat label={t('overview.stat.requirements')} value={requirements} detail={t('overview.stat.average', { average: features.length ? (requirements / features.length).toFixed(1) : '0' })}/>
      <Card padding={4}><VStack gap={1}>
        <Text type="supporting" color="secondary">{t('overview.stat.designs')}</Text>
        <Heading level={2}>{designed}<Text type="supporting" color="secondary"> / {features.length}</Text></Heading>
        <ProgressBar label={t('overview.stat.designRatio')} isLabelHidden value={designed} max={Math.max(1, features.length)} variant="accent"/>
      </VStack></Card>
      <Stat label={t('overview.stat.guides')} value={guides} detail={t('overview.stat.guidesDetail')}/>
      <Stat label={t('overview.stat.contributors')} value={contributors.length} detail={t('overview.stat.contributorsDetail')}/>
    </Grid>

    <Grid columns={{ minWidth: 300, repeat: 'fit', max: 2 }} gap={4} align="start">
      <Card padding={5}><VStack gap={4}>
        <Heading level={3}>{t('overview.byFeature')}</Heading>
        {ranked.length ? <VStack as="ul" gap={3} className={styles.barRows} aria-label={t('overview.byFeatureList')}>
          {ranked.slice(0, 8).map(f => <VStack as="li" key={f.id} gap={1}>
            <HStack gap={3} className={styles.barRowHead}>
              <Link to="/features/$featureId" params={{ featureId: f.id }} className={styles.featureTitle}>{f.title}</Link>
              <Text type="supporting" color="secondary">{t('overview.requirementCount', { count: f.requirements.length })}{f.design ? '' : ' · ' + t('overview.noDesign')}</Text>
            </HStack>
            <ProgressBar label={t('overview.featureRequirements', { title: f.title })} isLabelHidden value={f.requirements.length} max={mostRequirements} variant="accent"/>
          </VStack>)}
          {ranked.length > 8 && <Text type="supporting" color="secondary">{t('overview.topFeatures')} <Link to="/features">{t('overview.allRequirements')}</Link></Text>}
        </VStack> : <Text type="supporting" color="secondary">{t('overview.noFeatures')}</Text>}
      </VStack></Card>
      <VStack gap={4}>
        <Card padding={5}><VStack gap={4}>
          <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.recentChangeTypes')}</Heading><Text type="supporting" color="secondary">{t('overview.loadedEvents', { count: events.length })}</Text></HStack>
          <StackedBar segments={changes} label={t('overview.recentChangeTypes')}/>
        </VStack></Card>
        <Card padding={5}><VStack gap={4}>
          <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.commitsByContributor')}</Heading><Link to="/contributors">{t('overview.contributorsLink')}</Link></HStack>
          <StackedBar segments={commitShare} label={t('overview.commitsByContributor')}/>
        </VStack></Card>
      </VStack>
    </Grid>

    <Card padding={5}><VStack gap={4}>
      <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('activity.recent')}</Heading><Link to="/">{t('overview.activityLink')}</Link></HStack>
      {recent.length ? <VStack as="ul" gap={0} className={styles.recentList} aria-label={t('activity.recent')}>
        {recent.map(e => { const spec = specOf(e); const title = e.after?.title ?? e.before?.title ?? spec?.title ?? e.id; return <HStack as="li" key={e.key} gap={3} className={styles.recentRow}>
          <Person name={e.author} email={e.email} avatarOnly/>
          <HStack gap={2} wrap="wrap" className={styles.recentBody}>
            <Token label={e.types.map(type => changeNames[type]).join('·')} size="sm"/>
            <Text type="supporting" color="secondary">{kindNames[e.kind ?? 'requirement']}</Text>
            <Link to="/" search={{ selected: e.key }} className={styles.entryTitle}>{title}</Link>
          </HStack>
          <Timestamp value={e.date} format="relative"/>
        </HStack>; })}
      </VStack> : <Text type="supporting" color="secondary">{t('overview.noActivity')}</Text>}
    </VStack></Card>

    {!product && <PageState kind="empty" isCompact title={t('overview.emptyTitle')} description={t('overview.emptyDescription')}/>}
  </VStack>;
}
