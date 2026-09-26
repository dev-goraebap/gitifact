import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CommandPalette } from '@astryxdesign/core/CommandPalette';
import { CommandPaletteInput, CommandPaletteFooter } from '@astryxdesign/core/CommandPalette';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Kbd } from '@astryxdesign/core/Kbd';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { PageState } from '../../../shared/ui/page-state';
import { useHotkeys } from '@astryxdesign/core/hooks';
import type { SearchableItem, SearchSource } from '@astryxdesign/core/Typeahead';
import type { BrowserSessionV3, BrowserSearchV3, SearchHit } from '@gitifact/contracts';
import { sessionOptions, searchRecords } from '../../../entities/project';
import { useSearchOpen, openSearch, setSearchOpen, closeSearch, typingDelay } from '../../../shared/lib/search';
import { t, useLanguage } from '../../../shared/i18n';
import styles from './search-palette.module.css';

type Kind = SearchHit['kind'];
type Group = BrowserSearchV3['groups'][number];
type Target = { to: string; params?: Record<string, string>; search?: Record<string, string>; hash?: string };
// A row is a hit, or the last row of a group that has more: choosing it reads the group's next page.
type Hit = SearchableItem<{ group: string; kind: Kind | 'more'; where: string; line: string; target?: Target; more?: Group['group'] }>;

const groupNames: () => Record<Group['group'], string> = () => ({
  feature: t('search.group.feature'), requirement: t('search.group.requirement'), design: t('search.group.design'),
  instruction: t('search.group.instruction'), record: t('search.group.record'), commit: t('search.group.commit'), recent: t('search.group.recent'),
});

/** Where a hit opens: the feature on the right tab, the instruction, the record, or the commit. */
function targetOf(hit: SearchHit): Target {
  if (hit.kind === 'instruction') return { to: '/instructions/$instructionId', params: { instructionId: hit.id } };
  if (hit.kind === 'record') return { to: '/records/$recordId', params: { recordId: hit.id } };
  if (hit.kind === 'commit') return { to: '/records/commits/$commit', params: { commit: hit.id } };
  const params = { featureId: hit.featureId ?? '' };
  if (hit.kind === 'requirement') return { to: '/features/$featureId', params, search: { tab: 'requirements' }, hash: hit.id };
  if (hit.kind === 'design') return { to: '/features/$featureId', params, search: { tab: 'design' }, hash: hit.id };
  return { to: '/features/$featureId', params };
}

/** The rows of the groups as the server ordered them, each group closed by a "more" row while it has more. */
function rowsOf(groups: Group[]): Hit[] {
  return groups.flatMap(g => [
    ...g.hits.map((hit): Hit => ({ id: hit.kind + ':' + hit.id, label: hit.title,
      auxiliaryData: { group: groupNames()[g.group], kind: hit.kind, where: hit.where, line: hit.line, target: targetOf(hit) } })),
    ...(g.next ? [{ id: 'more:' + g.group, label: t('search.more', { count: g.total - g.hits.length }),
      auxiliaryData: { group: groupNames()[g.group], kind: 'more' as const, where: '', line: '', more: g.group } }] : []),
  ]);
}

function marked(text: string, query: string) {
  if (!query) return text;
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark className={styles.hit}>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
}

const nothing: SearchSource<Hit> = { bootstrap: () => [], search: () => [] };

/**
 * Shaped like the list it stands in for — group headings and two-line rows on the same measurements as a result —
 * so the placeholder and the documents occupy the same places and nothing shifts when they arrive.
 */
const loadingRow = (key: number) => <VStack key={key} gap={2} className={styles.loadingRow} aria-hidden="true">
  <Skeleton index={key} width={`${44 - key * 5}%`} height="var(--spacing-5)"/>
  <Skeleton index={key} width={`${88 - key * 7}%`} height="var(--spacing-3)"/>
</VStack>;
const loadingGroup = (key: number, heading: string, rows: number[]) => <VStack key={key} gap={0} aria-hidden="true">
  <VStack gap={0} className={styles.loadingHeading}><Skeleton index={key} width={heading} height="var(--spacing-3)"/></VStack>
  {rows.map(loadingRow)}
</VStack>;
const loading = () => (<VStack gap={0} role="status" aria-label={t('search.loading')} aria-busy="true" className={styles.loading}>
  {loadingGroup(0, '4rem', [0, 1, 2])}
  {loadingGroup(1, '5.5rem', [3, 4])}
</VStack>);
const noMatch = () => (<PageState kind="search" isCompact title={t('search.noMatch')} description={t('search.noMatchDescription')}/>);
const noDocuments = () => (<PageState kind="empty" isCompact title={t('search.empty')} description={t('search.emptyDescription')}/>);

// Keep keyboard hints in the selected display language.
const hints = () => (<CommandPaletteFooter>
  <HStack gap={4}>
    <HStack gap={2}><Kbd keys="up"/><Kbd keys="down"/><Text type="supporting" color="secondary">{t('search.hint.move')}</Text></HStack>
    <HStack gap={2}><Kbd keys="enter"/><Text type="supporting" color="secondary">{t('search.hint.open')}</Text></HStack>
    <HStack gap={2}><Kbd keys="escape"/><Text type="supporting" color="secondary">{t('search.hint.close')}</Text></HStack>
  </HStack>
</CommandPaletteFooter>);

/** The shortcut and the dialog exist from the first paint; the documents arrive with the session. */
export function SearchPalette() {
  useLanguage();
  const isOpen = useSearchOpen();
  useHotkeys([{ keys: 'mod+k', onPress: openSearch, allowInInputs: true }]);
  const session = useQuery(sessionOptions());
  if (!session.data) return <CommandPalette isOpen={isOpen} onOpenChange={setSearchOpen} searchSource={nothing}
    label={t('search.label')} width={720} className={styles.palette} input={<CommandPaletteInput placeholder={t('search.placeholder')}/>} footer={hints()}
    emptyBootstrapText={loading()} emptySearchText={loading()}/>;
  return <LoadedPalette session={session.data} isOpen={isOpen}/>;
}

function LoadedPalette({ session, isOpen }: { session: BrowserSessionV3; isOpen: boolean }) {
  useLanguage();
  const navigate = useNavigate();

  // The groups of the last words searched, with the pages of each read so far. The server works out every group; the
  // palette keeps what it was given and draws it.
  const current = useRef<{ query: string; groups: Group[] }>({ query: '', groups: [] });
  const [opening, setOpening] = useState(true);
  const source = useMemo(() => ({
    // Nothing typed yet: the features and instructions touched most recently.
    bootstrap: async (): Promise<Hit[]> => {
      try { return rowsOf((await searchRecords(session, '')).groups); } catch { return []; } finally { setOpening(false); }
    },
    search: async (raw: string, signal: AbortSignal): Promise<Hit[]> => {
      const query = raw.trim();
      if (!query) return [];
      // The same words again are the palette asking to redraw after a group read on: the groups are already here.
      if (query === current.current.query) return rowsOf(current.current.groups);
      const answer = await searchRecords(session, query, signal);
      current.current = { query, groups: answer.groups };
      return rowsOf(answer.groups);
    },
  }), [session]);

  // The palette owns the text field and reports no query, so the last query the source was asked for is what the
  // rows highlight. It is written before the results are set and read while they render, so it is never behind.
  const asked = useRef('');
  const shown = useRef<Hit[]>([]);
  const latest = useRef(source);
  latest.current = source;

  // Between a keystroke and its results the palette narrows what it already shows by title, and shows its empty
  // state when nothing is left. Typing the first word therefore flashed "no documents" over the opening list for as
  // long as the search took. While a search is on its way the empty state is the loading placeholder instead. The flag
  // is raised by the input's own change event: the palette runs the search inside a transition, and a state set there
  // would only show once the results were in.
  const [waiting, setWaiting] = useState(false);
  const watching = useMemo<SearchSource<Hit>>(() => {
    let waiting: ReturnType<typeof setTimeout> | undefined;
    let inflight: AbortController | undefined;
    let queued: ((results: Hit[]) => void)[] = [];
    // Every keystroke's promise is answered, not just the last one. The palette runs each search inside a transition
    // and stays busy until that promise settles, so abandoning the superseded ones left the spinner turning forever.
    const settle = (results: Hit[]) => { const waiters = queued; queued = []; setWaiting(false); for (const resolve of waiters) resolve(results); };
    return {
      // The opening list keeps its own promise: sharing one with the search let a keystroke answer the bootstrap
      // call, and the palette then showed both lists at once.
      bootstrap: () => latest.current.bootstrap().then(rows => (shown.current = rows)),
      // Results appear once typing pauses; until then the palette keeps what is shown. Words already answered (a
      // redraw after "more") need no pause.
      search: query => new Promise<Hit[]>(resolve => {
        queued.push(resolve);
        clearTimeout(waiting);
        const run = () => {
          // A newer query makes the one still on its way pointless; its answer is dropped.
          inflight?.abort(); const controller = inflight = new AbortController();
          void latest.current.search(query, controller.signal)
            .then(results => { if (controller.signal.aborted) return; asked.current = query.trim().toLowerCase(); settle(shown.current = results); })
            .catch(() => { if (!controller.signal.aborted) settle(shown.current = []); });
        };
        if (query.trim() && query.trim() === current.current.query) run(); else waiting = setTimeout(run, typingDelay);
      }),
      cancel: () => { clearTimeout(waiting); inflight?.abort(); settle(shown.current); },
    };
  }, []);

  // Choosing a row closes the palette. Choosing "more" must not: the palette is kept open, the group's next page is
  // read, and the words are put back in the field, which is how the palette is told to draw its rows again.
  const reading = useRef<Group['group'] | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);
  const readOn = async (group: Group['group']) => {
    const { query, groups } = current.current;
    const at = groups.find(g => g.group === group);
    if (at?.next) {
      try {
        const [page] = (await searchRecords(session, query, undefined, { group, after: at.next })).groups;
        if (page) current.current = { query, groups: groups.map(g => g.group === group ? { ...g, hits: [...g.hits, ...page.hits], next: page.next } : g) };
      } catch { /* the row stays; choosing it again reads again */ }
    }
    reading.current = undefined;
    const input = field.current;
    if (!input) return;
    // React tracks the field's value; the native setter and an input event are how a typed value arrives.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, query);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  };

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    const data = hit.auxiliaryData!;
    if (data.more) { reading.current = data.more; void readOn(data.more); return; }
    const { to, params, search, hash } = data.target!;
    closeSearch();
    void navigate({ to, params: params ?? {}, search: search ?? {}, ...(hash ? { hash } : {}) } as never);
  };
  // Nothing is highlighted until the reader arrows down, so Enter on a fresh query did nothing. In a search palette
  // the first result is the answer, so Enter opens it while no row is highlighted and the palette keeps Enter after.
  const openFirstOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.currentTarget.getAttribute('aria-activedescendant')) return;
    const first = shown.current[0];
    if (!first) return;
    event.preventDefault();
    go(first);
  };

  return <CommandPalette
    isOpen={isOpen}
    onOpenChange={open => { if (open || !reading.current) setSearchOpen(open); }}
    searchSource={watching}
    label={t('search.label')}
    width={720}
    className={styles.palette}
    input={<CommandPaletteInput ref={field} placeholder={t('search.placeholder')} onKeyDown={openFirstOnEnter} onChange={event => { setWaiting(event.currentTarget.value.trim() !== ''); }}/>}
    footer={hints()}
    emptySearchText={waiting ? loading() : noMatch()}
    emptyBootstrapText={opening || waiting || reading.current ? loading() : noDocuments()}
    renderItem={(item: Hit) => {
      const data = item.auxiliaryData!;
      if (data.kind === 'more') return <Text type="supporting" color="secondary" className={styles.more}>{item.label}</Text>;
      const query = asked.current;
      return <VStack gap={1} className={styles.row}>
        <HStack gap={3} className={styles.head}>
          <Text weight="semibold" className={styles.oneLine}>{marked(item.label, query)}</Text>
          <Text type="supporting" color="secondary" className={styles.oneLine}>{data.where}</Text>
        </HStack>
        {data.line && <Text type="supporting" color="secondary" className={styles.oneLine}>{marked(data.line, query)}</Text>}
      </VStack>;
    }}
    onValueChange={id => { go(shown.current.find(entry => entry.id === id)); }}
  />;
}
