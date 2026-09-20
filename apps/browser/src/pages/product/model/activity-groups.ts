import type { SpecEvent } from '@gitifact/contracts';

/** One commit's changes in the order history sent them. `day` is set on the first commit of each calendar day. */
export type CommitGroup = { commit: string; events: SpecEvent[]; day: string | undefined };
/** The records one recorded reason explains. Its key is the reason text, so an empty key is a commit with none. */
export type ReasonGroup = { key: string; reasons: string[]; events: SpecEvent[] };

const dayOf = (iso: string) => new Date(iso).toDateString();

/**
 * History arrives newest first with every record of a commit together, so a run of equal commits is one group; a
 * commit split across two pages joins back up when the pages are read as one list. The day marker carries the date
 * of the first commit of that day, read in the viewer's own zone.
 */
export function groupCommits(events: SpecEvent[]): CommitGroup[] {
  const groups: CommitGroup[] = [];
  let day: string | undefined;
  for (const event of events) {
    const last = groups.at(-1);
    if (last && last.commit === event.commit) { last.events.push(event); continue; }
    const turned = dayOf(event.date) !== day;
    day = dayOf(event.date);
    groups.push({ commit: event.commit, events: [event], day: turned ? event.date : undefined });
  }
  return groups;
}

/**
 * The reason a change was made is stored against every record it changed, so one sentence covers several records —
 * up to 26 of them in this repository. Grouping by the reason writes it once over the records it explains; a commit
 * that recorded several intents keeps them apart, which listing the reasons together would lose.
 */
export function groupReasons(events: SpecEvent[]): ReasonGroup[] {
  const groups: ReasonGroup[] = [];
  for (const event of events) {
    const key = event.reasons.join('\n');
    const found = groups.find(group => group.key === key);
    if (found) found.events.push(event);
    else groups.push({ key, reasons: event.reasons, events: [event] });
  }
  return groups;
}
