import type { SpecEvent, SpecRecord } from '@gitifact/contracts';

/** One commit's changes in the order history sent them. `day` is set on the first commit of each calendar day. */
export type CommitGroup = { commit: string; events: SpecEvent[]; day: string | undefined };
/**
 * The changes one record explains. A group without a record holds the changes no record explains; `missing` says
 * whether one of them needed a record — changing, moving or deleting what was there — rather than only adding.
 */
export type RecordGroup = { key: string; ids: string[]; record: SpecRecord | null; events: SpecEvent[]; missing: boolean };

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
 * The records of a commit, each over the changes it explains: the record is the entry, the commit only says who and
 * when. A change two records explain appears under both, since one file's change cannot be split between them.
 * Changes no record explains come last in one group.
 * A reason from before decision records (`H-`) was stored once per document in 0.7, so the same text arrives under
 * a different ID for each document it explained; within a commit those are one group, as the reason was written once.
 */
const sameReason = (a: SpecRecord, b: SpecRecord) => a.id.startsWith('H-') && b.id.startsWith('H-') && a.title === b.title
  && a.sections.length === b.sections.length && a.sections.every((s, i) => s.key === b.sections[i]!.key && s.body === b.sections[i]!.body);

export function groupRecords(events: SpecEvent[]): RecordGroup[] {
  const groups: RecordGroup[] = [];
  const bare: SpecEvent[] = [];
  for (const event of events) {
    if (!event.records.length) { bare.push(event); continue; }
    for (const record of event.records) {
      const found = groups.find(group => group.ids.includes(record.id) || (group.record && sameReason(group.record, record)));
      if (found) { if (!found.ids.includes(record.id)) found.ids.push(record.id); if (!found.events.includes(event)) found.events.push(event); }
      else groups.push({ key: record.id, ids: [record.id], record, events: [event], missing: false });
    }
  }
  if (bare.length) groups.push({ key: '', ids: [], record: null, events: bare, missing: bare.some(e => e.types.some(type => type !== 'created')) });
  return groups;
}
