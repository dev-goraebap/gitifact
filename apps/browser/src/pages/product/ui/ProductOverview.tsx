import type { SpecDocument, SpecEvent, SpecFeature, BrowserSessionV2, BrowserSpecsV3 } from '@gitifact/contracts';
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
import { Person } from './Person';
import { statusOptions } from '../../../entities/project';
import styles from './product.module.css';
import { t } from '../../../shared/i18n';

type Contributor = NonNullable<BrowserSpecsV3['contributors']>[number];
type ChangeType = SpecEvent['types'][number];

// Categorical hues in a fixed order validated for adjacent-pair CVD separation (blue → orange → purple → green); gray closes a tail.
const series = ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-purple, #6B1EFD)', 'var(--color-data-categorical-green, #0B991F)'] as const;
const tail = 'var(--color-data-neutral, #8494A3)';
const changeNames: Record<ChangeType, string> = { created: t('change.created'), modified: t('change.modified'), moved: t('change.moved'), deleted: t('change.deleted') };
const changeOrder: ChangeType[] = ['created', 'modified', 'moved', 'deleted'];
const kindNames: Record<NonNullable<SpecEvent['kind']>, string> = { requirement: t('kind.requirement'), design: t('kind.design'), wiki: t('kind.wiki') };
const day = 86_400_000;

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

/**
 * Changes per day across the loaded history, as one column per day. A single series, so it carries no legend; the
 * caption states that it counts the loaded range rather than the whole repository.
 */
function Pulse({ events }: { events: SpecEvent[] }) {
  const times = events.map(e => Date.parse(e.date)).filter(Number.isFinite);
  if (!times.length) return null;
  const last = new Date(Math.max(...times)); last.setHours(0, 0, 0, 0);
  const span = 21;
  const counts = Array.from({ length: span }, (_, i) => {
    const start = last.getTime() - (span - 1 - i) * day;
    return { start, value: times.filter(time => time >= start && time < start + day).length };
  });
  const peak = Math.max(1, ...counts.map(c => c.value));
  const width = 100 / span;
  return <VStack gap={2} className={styles.pulse}>
    <svg role="img" aria-label={t('overview.pulse', { days: span })} width="100%" height="44" preserveAspectRatio="none" viewBox="0 0 100 44">
      {counts.map(c => {
        const height = c.value ? Math.max(3, (c.value / peak) * 44) : 2;
        return <rect key={c.start} x={`${(c.start - counts[0]!.start) / day * width + width * 0.15}`} width={width * 0.7} y={44 - height} height={height} rx="1"
          className={c.value ? styles.pulseBar : styles.pulseEmpty}>
          <title>{`${new Date(c.start).toLocaleDateString()} ${c.value}`}</title>
        </rect>;
      })}
    </svg>
    <Text type="supporting" color="secondary">{t('overview.pulse', { days: span })} · {t('overview.loadedEvents', { count: events.length })}</Text>
  </VStack>;
}

/**
 * One commit: the reason it was made, then the records it touched. Grouping by commit is what keeps the reason
 * readable — the same sentence is recorded against every record the commit changed, and listing it per record
 * printed the same paragraph several times in a row.
 */
function CommitGroup({ events, titleOf }: { events: SpecEvent[]; titleOf: (event: SpecEvent) => string }) {
  const first = events[0]!;
  const reasons = [...new Set(events.flatMap(e => e.reasons))];
  return <VStack as="li" gap={3} className={styles.changeRow}>
    <HStack gap={3} wrap="wrap" className={styles.changeHead}>
      <Person name={first.author} email={first.email}/>
      <Timestamp value={first.date} format="relative"/>
    </HStack>
    {reasons.length
      // One reason per commit: a commit that touched several records records the same intent against each of them,
      // and counting the rest here asked the reader to wonder what was hidden. The activity screen has them all.
      ? <Text maxLines={2} className={styles.reason}>{reasons[0]}</Text>
      : <Text color="secondary" className={styles.reason}>{t('activity.noReason')}</Text>}
    <HStack as="ul" gap={3} wrap="wrap" className={styles.recordList}>
      {events.map(e => <HStack as="li" key={e.key} gap={2} className={styles.record}>
        <Token label={e.types.map(type => changeNames[type]).join('·')} size="sm"/>
        <Text type="supporting" color="secondary">{kindNames[e.kind ?? 'requirement']}</Text>
        <Link to="/activity" search={{ selected: e.key }} className={styles.changeTitle}>{titleOf(e)}</Link>
      </HStack>)}
    </HStack>
  </VStack>;
}

/**
 * The overview opens with the project and its size on one line, then the two loaded-range bars that show how the
 * recent work is shaped, then the reasons behind the last commits — what the product records and what a returning
 * reader comes back for. The wiki README is the wiki's policy, not a product document, so the dashboard neither
 * shows nor links it.
 */
export function ProductOverview({ session, features, documents, events, contributors, working }: { session: BrowserSessionV2; features: SpecFeature[]; documents: SpecDocument[]; events: SpecEvent[]; contributors: Contributor[]; working: boolean }) {
  const status = useQuery(statusOptions(session));
  const project = status.data?.repository.rootPath?.split(/[\/]/).filter(Boolean).at(-1);
  const requirements = features.reduce((sum, f) => sum + f.requirements.length, 0);
  const changes: Segment[] = changeOrder.map((type, i) => ({ label: changeNames[type], value: events.filter(e => e.types.includes(type)).length, color: series[i]! }));
  const byCommits = [...contributors].sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const commitShare: Segment[] = [...byCommits.slice(0, 3).map((p, i) => ({ label: p.name, value: p.commits, color: series[i]! })), ...(byCommits.length > 3 ? [{ label: t('overview.otherContributors', { count: byCommits.length - 3 }), value: byCommits.slice(3).reduce((sum, p) => sum + p.commits, 0), color: tail }] : [])];
  // Events arrive newest first, so commits are already contiguous. Three commits, each showing one reason, keep the
  // section to about one screen; the rest of the record is one click away in the activity timeline.
  const groups: SpecEvent[][] = [];
  for (const event of events) {
    const open = groups.at(-1);
    if (open && open[0]!.commit === event.commit) open.push(event); else groups.push([event]);
    if (groups.length > 3) break;
  }
  if (groups.length > 3) groups.length = 3;
  const specOf = (e: SpecEvent) => e.kind === 'wiki' ? documents.find(d => d.id === e.id) : features.find(f => f.id === e.id || f.requirements.some(r => r.id === e.id));
  const titleOf = (e: SpecEvent) => e.after?.title ?? e.before?.title ?? specOf(e)?.title ?? e.id;
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
          {fact(t('overview.stat.wiki'), documents.length)}
          {fact(t('overview.stat.contributors'), contributors.length)}
        </HStack>
        <HStack gap={3} wrap="wrap" className={styles.heroState}>
          {working && <Token label={t('overview.uncommittedToken')} color="yellow" size="sm"/>}
          {events[0] && <Text type="supporting" color="secondary">{t('common.recentChange')} <Timestamp value={events[0].date} format="relative"/></Text>}
        </HStack>
      </VStack>
      <Pulse events={events}/>
    </HStack>

    <Grid columns={{ minWidth: 300, repeat: 'fit', max: 2 }} gap={4} align="start">
      <Card padding={5}><VStack gap={4}>
        <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.recentChangeTypes')}</Heading><Text type="supporting" color="secondary">{t('overview.loadedEvents', { count: events.length })}</Text></HStack>
        <StackedBar segments={changes} label={t('overview.recentChangeTypes')}/>
      </VStack></Card>
      <Card padding={5}><VStack gap={4}>
        <HStack gap={3} className={styles.barRowHead}><Heading level={3}>{t('overview.commitsByContributor')}</Heading><Link to="/contributors">{t('overview.contributorsLink')}</Link></HStack>
        <StackedBar segments={commitShare} label={t('overview.commitsByContributor')}/>
      </VStack></Card>
    </Grid>

    <VStack gap={4} className={styles.lead}>
      <HStack gap={3} className={styles.barRowHead}>
        <Heading level={2}>{t('overview.changeReasons')}</Heading>
        <Link to="/activity">{t('overview.activityLink')}</Link>
      </HStack>
      {groups.length
        ? <VStack as="ul" gap={0} className={styles.changeList} aria-label={t('overview.changeReasons')}>
          {groups.map(group => <CommitGroup key={group[0]!.key} events={group} titleOf={titleOf}/>)}
        </VStack>
        : <Text color="secondary">{t('overview.noActivity')}</Text>}
    </VStack>
  </VStack>;
}
