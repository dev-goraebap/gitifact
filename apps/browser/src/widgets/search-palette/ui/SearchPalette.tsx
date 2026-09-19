import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { BrowserSessionV2, BrowserSearchV1 } from '@gitifact/contracts';
import { sessionOptions, specsOptions, searchRecords } from '../../../entities/project';
import { useSearchOpen, openSearch, setSearchOpen, closeSearch, typingDelay } from '../../../shared/lib/search';
import { t } from '../../../shared/i18n';
import styles from './search-palette.module.css';

type Kind = 'feature' | 'requirement' | 'design' | 'document' | 'history';
type Target = { to: string; params?: Record<string, string>; search?: Record<string, string>; hash?: string };
// `line` is the matched line the server cut; the opening list shows the start of the body instead.
type Hit = SearchableItem<{ group: string; kind: Kind; where: string; body: string; line?: string; target: Target; updatedAt: string | null }>;

const groupNames: Record<Kind, string> = {
  feature: t('search.group.feature'), requirement: t('search.group.requirement'),
  design: t('search.group.design'), document: t('search.group.document'), history: t('search.group.history'),
};

/** Where a server hit opens: the feature on the right tab, the wiki page, or the change in the activity. */
function targetOf(hit: BrowserSearchV1['hits'][number]): Target {
  if (hit.kind === 'document') return { to: '/wiki/$documentId', params: { documentId: hit.documentId ?? '' } };
  if (hit.kind === 'history') return { to: '/activity', search: { selected: hit.key ?? '' } };
  const params = { featureId: hit.featureId ?? '' };
  if (hit.kind === 'requirement') return { to: '/features/$featureId', params, search: { tab: 'requirements' }, hash: hit.id };
  if (hit.kind === 'design') return { to: '/features/$featureId', params, search: { tab: 'design' } };
  return { to: '/features/$featureId', params };
}

/**
 * Plain text of a Markdown body, so a match is judged and shown on what the reader sees rather than on syntax.
 * Markers are only removed where they mark: at the start of a line, or around a link. Stripping every hyphen and
 * pipe wherever it appeared turned dates into "2026 09 18".
 */
function plain(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*[#>]+\s*/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\|/gm, ' ').replace(/\|/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/**
 * One line of the body around the first match, with the matched run marked. The palette is for finding a document,
 * so the line is evidence that the word is really in there — not a preview of the document.
 */
function snippet(body: string, query: string) {
  const at = body.toLowerCase().indexOf(query);
  if (at < 0) return body.slice(0, 90);
  const from = Math.max(0, at - 30);
  return (from > 0 ? '…' : '') + body.slice(from, at + query.length + 70).trim() + (at + query.length + 70 < body.length ? '…' : '');
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
const loading = <VStack gap={0} role="status" aria-label={t('search.loading')} aria-busy="true" className={styles.loading}>
  {loadingGroup(0, '4rem', [0, 1, 2])}
  {loadingGroup(1, '5.5rem', [3, 4])}
</VStack>;
const noMatch = <PageState kind="search" isCompact title={t('search.noMatch')} description={t('search.noMatchDescription')}/>;
const noDocuments = <PageState kind="empty" isCompact title={t('search.empty')} description={t('search.emptyDescription')}/>;

// Astryx's default footer spells its hints in English; the rest of this app speaks the project's language.
const hints = <CommandPaletteFooter>
  <HStack gap={4}>
    <HStack gap={2}><Kbd keys="up"/><Kbd keys="down"/><Text type="supporting" color="secondary">{t('search.hint.move')}</Text></HStack>
    <HStack gap={2}><Kbd keys="enter"/><Text type="supporting" color="secondary">{t('search.hint.open')}</Text></HStack>
    <HStack gap={2}><Kbd keys="escape"/><Text type="supporting" color="secondary">{t('search.hint.close')}</Text></HStack>
  </HStack>
</CommandPaletteFooter>;

/** The shortcut and the dialog exist from the first paint; the documents arrive with the session. */
export function SearchPalette() {
  const isOpen = useSearchOpen();
  useHotkeys([{ keys: 'mod+k', onPress: openSearch, allowInInputs: true }]);
  const session = useQuery(sessionOptions());
  if (!session.data) return <CommandPalette isOpen={isOpen} onOpenChange={setSearchOpen} searchSource={nothing}
    label={t('search.label')} width={720} className={styles.palette} input={<CommandPaletteInput placeholder={t('search.placeholder')}/>} footer={hints}
    emptyBootstrapText={loading} emptySearchText={loading}/>;
  return <LoadedPalette session={session.data} isOpen={isOpen}/>;
}

function LoadedPalette({ session, isOpen }: { session: BrowserSessionV2; isOpen: boolean }) {
  const navigate = useNavigate();
  // The checkout is only read once the palette is opened, so the shell never fetches it just to be ready.
  const specs = useQuery({ ...specsOptions(session), enabled: isOpen });
  const checkout = specs.data;

  const entries = useMemo<Hit[]>(() => {
    if (!checkout) return [];
    const out: Hit[] = [];
    for (const feature of checkout.features) {
      out.push({ id: feature.id, label: feature.title, auxiliaryData: { group: groupNames.feature, kind: 'feature',
        where: feature.path.replace(/^\.gitifact\//, ''), body: plain(feature.description), updatedAt: feature.updatedAt,
        target: { to: '/features/$featureId', params: { featureId: feature.id } } } });
      for (const requirement of feature.requirements) {
        out.push({ id: requirement.id, label: requirement.title, auxiliaryData: { group: groupNames.requirement, kind: 'requirement',
          where: feature.title, body: plain(requirement.body), updatedAt: feature.updatedAt,
          target: { to: '/features/$featureId', params: { featureId: feature.id }, search: { tab: 'requirements' }, hash: requirement.id } } });
      }
      if (feature.design) out.push({ id: feature.id + ':design', label: feature.design.title, auxiliaryData: { group: groupNames.design, kind: 'design',
        where: feature.title, body: plain(feature.design.body), updatedAt: feature.updatedAt,
        target: { to: '/features/$featureId', params: { featureId: feature.id }, search: { tab: 'design' } } } });
    }
    for (const document of checkout.documents) {
      out.push({ id: document.id, label: document.title, auxiliaryData: { group: groupNames.document, kind: 'document',
        where: document.path.replace(/^\.gitifact\/wiki\//, ''), body: plain(document.body), updatedAt: document.updatedAt,
        target: { to: '/wiki/$documentId', params: { documentId: document.id } } } });
    }
    return out;
  }, [checkout]);

  const source = useMemo(() => ({
    // Nothing typed yet: the files touched most recently. Requirements and designs carry their feature's timestamp,
    // so including them filled the list with one feature's requirements instead of showing six different documents.
    bootstrap: () => entries
      .filter(entry => entry.auxiliaryData?.updatedAt && (entry.auxiliaryData.kind === 'feature' || entry.auxiliaryData.kind === 'document'))
      .sort((a, b) => (b.auxiliaryData?.updatedAt ?? '').localeCompare(a.auxiliaryData?.updatedAt ?? ''))
      .slice(0, 6)
      .map(entry => ({ ...entry, auxiliaryData: { ...entry.auxiliaryData!, group: t('search.group.recent') } })),
    // The server searches the checkout and all of history. A title match comes first, then the place, then the text,
    // then past changes, newest first.
    search: async (raw: string, signal: AbortSignal): Promise<Hit[]> => {
      const query = raw.trim();
      if (!query) return [];
      const answer = await searchRecords(session, query, checkout?.head ?? null, signal);
      return answer.hits.map(hit => ({ id: hit.kind + ':' + hit.id, label: hit.title, auxiliaryData: { group: groupNames[hit.kind], kind: hit.kind,
        where: hit.where, body: hit.line, line: hit.line, updatedAt: null, target: targetOf(hit) } }));
    },
  }), [entries, session, checkout]);

  // The palette owns the text field and reports no query, so the last query the source was asked for is what the
  // rows highlight. It is written before the results are set and read while they render, so it is never behind.
  const asked = useRef('');
  const shown = useRef<Hit[]>([]);
  // The palette searches on open and on every keystroke, and never again on its own. So the source is read through a
  // ref and answers late rather than answering empty: a reader who types before the documents have been read would
  // otherwise be left with an empty list for a query that does match.
  const latest = useRef(source);
  latest.current = source;
  const arrived = useRef<{ wait: Promise<void>; done: () => void }>(undefined);
  if (!arrived.current) {
    let done = () => {};
    const wait = new Promise<void>(resolve => { done = resolve; });
    arrived.current = { wait, done };
  }
  useEffect(() => { if (checkout) arrived.current!.done(); }, [checkout]);

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
      // The opening list waits for the documents but never for the typing delay, and keeps its own promise: sharing
      // one with the search let a keystroke answer the bootstrap call, and the palette then showed both lists at once.
      bootstrap: () => arrived.current!.wait.then(() => (shown.current = latest.current.bootstrap())),
      // The results are computed here, not fetched, but showing them on every keystroke made the list flicker
      // through partial words. They appear once typing pauses; until then the palette keeps what is shown.
      search: query => new Promise<Hit[]>(resolve => {
        queued.push(resolve);
        clearTimeout(waiting);
        waiting = setTimeout(() => {
          // A newer query makes the one still on its way pointless; its answer is dropped.
          inflight?.abort(); const controller = inflight = new AbortController();
          void arrived.current!.wait
            .then(() => latest.current.search(query, controller.signal))
            .then(results => { if (controller.signal.aborted) return; asked.current = query.trim().toLowerCase(); settle(shown.current = results); })
            .catch(() => { if (!controller.signal.aborted) settle(shown.current = []); });
        }, typingDelay);
      }),
      cancel: () => { clearTimeout(waiting); inflight?.abort(); settle(shown.current); },
    };
  }, []);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    const { to, params, search, hash } = hit.auxiliaryData!.target;
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
    onOpenChange={setSearchOpen}
    searchSource={watching}
    label={t('search.label')}
    width={720}
    className={styles.palette}
    input={<CommandPaletteInput placeholder={t('search.placeholder')} onKeyDown={openFirstOnEnter} onChange={event => { setWaiting(event.currentTarget.value.trim() !== ''); }}/>}
    footer={hints}
    emptySearchText={waiting ? loading : noMatch}
    emptyBootstrapText={specs.isPending || waiting ? loading : noDocuments}
    renderItem={(item: Hit) => {
      const data = item.auxiliaryData!;
      const query = asked.current;
      const line = data.line ?? (query ? snippet(data.body, query) : data.body.slice(0, 90));
      return <VStack gap={1} className={styles.row}>
        <HStack gap={3} className={styles.head}>
          <Text weight="semibold" className={styles.oneLine}>{marked(item.label, query)}</Text>
          <Text type="supporting" color="secondary" className={styles.oneLine}>{data.where}</Text>
        </HStack>
        {line && <Text type="supporting" color="secondary" className={styles.oneLine}>{marked(line, query)}</Text>}
      </VStack>;
    }}
    onValueChange={id => { go(shown.current.find(entry => entry.id === id)); }}
  />;
}
