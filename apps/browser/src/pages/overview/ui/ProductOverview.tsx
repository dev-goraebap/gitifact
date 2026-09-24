import type { SpecEvent, SpecFeature, BrowserSessionV3, BrowserSpecsV6, BrowserHistorySummaryV4 } from '@gitifact/contracts';
import { useQuery } from '@tanstack/react-query';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Grid } from '@astryxdesign/core/Grid';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { ActivityTimeline, TimelineSkeleton } from '../../../widgets/activity-timeline';
import { statusOptions, summaryOptions } from '../../../entities/project';
import styles from './overview.module.css';
import { t, useLanguage, getLanguage } from '../../../shared/i18n';

type Contributor = NonNullable<BrowserSpecsV6['contributors']>[number];
type ChangeType = SpecEvent['types'][number];

// Categorical hues in a fixed order validated for adjacent-pair CVD separation (blue → orange → purple → green); gray closes a tail.
const series = ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-purple, #6B1EFD)', 'var(--color-data-categorical-green, #0B991F)'] as const;
const tail = 'var(--color-data-neutral, #8494A3)';
const changeNames: () => Record<ChangeType, string> = () => ({ created: t('change.created'), modified: t('change.modified'), moved: t('change.moved'), deleted: t('change.deleted') });
const changeOrder: ChangeType[] = ['created', 'modified', 'moved', 'deleted'];
const kindNames: () => Record<NonNullable<SpecEvent['kind']>, string> = () => ({ feature: t('kind.feature'), requirement: t('kind.requirement'), design: t('kind.design'), wiki: t('kind.wiki'), instruction: t('kind.instruction') });
const day = 86_400_000;
// A commit that introduced the project can hold hundreds of records; the overview shows this many and links on.
const RECENT_RECORDS = 10;

type Segment = { label: string; value: number; color: string };

/** One horizontal part-to-whole bar; each segment carries its own title for hover and a 2px surface gap from its neighbour. */
function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  useLanguage();
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

/**
 * Changes per day across the loaded history, as one column per day. A single series, so it carries no legend; the
 * caption states that it counts the loaded range rather than the whole repository.
 */
function Pulse({ pulse, total }: { pulse: BrowserHistorySummaryV4['pulse']; total: number }) {
  useLanguage();
  // The server sends one entry per commit of the last three weeks; they are counted here by the reader's own day.
  const times = pulse.flatMap(c => { const time = Date.parse(c.date); return Number.isFinite(time) ? [{ time, count: c.count }] : []; });
  if (!times.length) return null;
  const last = new Date(Math.max(...times.map(c => c.time))); last.setHours(0, 0, 0, 0);
  const span = 21;
  const counts = Array.from({ length: span }, (_, i) => {
    const start = last.getTime() - (span - 1 - i) * day;
    return { start, value: times.filter(c => c.time >= start && c.time < start + day).reduce((sum, c) => sum + c.count, 0) };
  });
  const peak = Math.max(1, ...counts.map(c => c.value));
  const width = 100 / span;
  return <VStack gap={2} className={styles.pulse}>
    <svg role="img" aria-label={t('overview.pulse', { days: span })} width="100%" height="44" preserveAspectRatio="none" viewBox="0 0 100 44">
      {counts.map(c => {
        const height = c.value ? Math.max(3, (c.value / peak) * 44) : 2;
        return <rect key={c.start} x={`${(c.start - counts[0]!.start) / day * width + width * 0.15}`} width={width * 0.7} y={44 - height} height={height} rx="1"
          className={c.value ? styles.pulseBar : styles.pulseEmpty}>
          <title>{`${new Date(c.start).toLocaleDateString(getLanguage())} ${c.value}`}</title>
        </rect>;
      })}
    </svg>
    <Text type="supporting" color="secondary">{t('overview.pulse', { days: span })} · {t('overview.totalEvents', { count: total })}</Text>
  </VStack>;
}

/**
 * The overview opens with the project and its size on one line, then the two bars that show how the work is shaped
 * over all of history and who did it, then the reasons behind the last commits — what the product records and what a returning
 * reader comes back for.
 */
export function ProductOverview({ session, head, features, instructions, contributors, working }: { session: BrowserSessionV3; head: string | null; features: SpecFeature[]; instructions: number; contributors: Contributor[]; working: boolean }) {
  useLanguage();
  // Counts over all of history and its newest commits, from the server's index; nothing before the first commit.
  const history = useQuery({ ...summaryOptions(session, head ?? ''), enabled: !!head });
  const summary = history.data;
  // History is its own query, so it can still be on its way after the checkout has drawn the page. Until it
  // answers there is no count yet — saying zero, or that nothing has been committed, states the opposite.
  const counting = !!head && !summary && !history.error;
  const status = useQuery(statusOptions(session));
  const project = status.data?.repository.rootPath?.split(/[\/]/).filter(Boolean).at(-1);
  const requirements = features.reduce((sum, f) => sum + f.requirements.length, 0);
  const changes: Segment[] = changeOrder.map((type, i) => ({ label: changeNames()[type], value: summary?.byType[type] ?? 0, color: series[i]! }));
  const byCommits = [...contributors].sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const commitShare: Segment[] = [...byCommits.slice(0, 3).map((p, i) => ({ label: p.name, value: p.commits, color: series[i]! })), ...(byCommits.length > 3 ? [{ label: t('overview.otherContributors', { count: byCommits.length - 3 }), value: byCommits.slice(3).reduce((sum, p) => sum + p.commits, 0), color: tail }] : [])];
  // The newest commits, drawn by the activity screen's own timeline so the two read alike. A commit that created
  // hundreds of records at once would bury the page, so each shows RECENT_RECORDS of them and links on for the rest.
  const groups = summary?.recent ?? [];
  const newest = groups[0]?.events[0];
  const recent = groups.flatMap(g => g.events.slice(0, RECENT_RECORDS));
  const hidden = Object.fromEntries(groups.map(g => [g.commit, Math.max(0, g.count - Math.min(g.events.length, RECENT_RECORDS))]));
  const fact = (label: string, value: number) => <HStack gap={2} as="li" className={styles.fact}>
    <Text weight="semibold">{value}</Text><Text color="secondary">{label}</Text>
  </HStack>;

  return <VStack as="article" aria-label={t('nav.product')} gap={6} className={styles.dashboard}>
    <HStack gap={5} wrap="wrap" className={styles.hero}>
      <VStack gap={3} className={styles.heroText}>
        <Heading level={1}>{project ?? t('project.local')}</Heading>
        <HStack as="ul" gap={6} wrap="wrap" className={styles.facts} aria-label={t('overview.summary')}>
          {fact(t('overview.stat.features'), features.length)}
          {fact(t('overview.stat.requirements'), requirements)}
          {fact(t('overview.stat.instructions'), instructions)}
          {fact(t('overview.stat.contributors'), contributors.length)}
        </HStack>
        <HStack gap={3} wrap="wrap" className={styles.heroState}>
          {working && <Token label={t('overview.uncommittedToken')} color="yellow" size="sm"/>}
          {newest && <Text type="supporting" color="secondary">{t('common.recentChange')} <Timestamp value={newest.date} format="relative"/></Text>}
        </HStack>
      </VStack>
      {summary && <Pulse pulse={summary.pulse} total={summary.total}/>}
    </HStack>

    {/* The two cards stand side by side, so they take the taller one's height; a short legend no longer leaves one card hanging. */}
    <Grid columns={{ minWidth: 300, repeat: 'fit', max: 2 }} gap={4} align="stretch">
      <Card padding={5}><VStack gap={4}>
        <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.recentChangeTypes')}</Heading>{!counting && <Text type="supporting" color="secondary">{t('overview.totalEvents', { count: summary?.total ?? 0 })}</Text>}</HStack>
        {counting ? <Skeleton width="100%" height="var(--spacing-6)" radius={2}/> : <StackedBar segments={changes} label={t('overview.recentChangeTypes')}/>}
      </VStack></Card>
      <Card padding={5}><VStack gap={4}>
        <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.commitsByContributor')}</Heading><Link to="/contributors">{t('overview.contributorsLink')}</Link></HStack>
        <StackedBar segments={commitShare} label={t('overview.commitsByContributor')}/>
      </VStack></Card>
    </Grid>

    <VStack gap={4} className={styles.lead}>
      <HStack gap={3} className={styles.barRowHead}>
        <Heading level={2}>{t('overview.recentActivity')}</Heading>
        <Link to="/records">{t('overview.activityLink')}</Link>
      </HStack>
      {counting ? <TimelineSkeleton isPlain/>
        : recent.length
          ? <VStack gap={0} aria-label={t('overview.recentActivity')}>
            <ActivityTimeline events={recent} features={features} hidden={hidden}/>
          </VStack>
          : <Text color="secondary">{t('overview.noActivity')}</Text>}
    </VStack>
  </VStack>;
}
