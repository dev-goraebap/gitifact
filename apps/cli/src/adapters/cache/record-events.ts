import type { DecisionRecord } from '@gitifact/core';
import type { EventRecord } from './events.js';

/** A record with the documents it explains, before it is attached to the changes of those documents. */
export type AttachedRecord = EventRecord & { docs: string[] };

export const eventRecordOf = (record: DecisionRecord): AttachedRecord =>
  ({ id: record.id, title: record.title, docs: record.docs, sections: record.sections.map(s => ({ key: s.key, body: s.body })) });

/**
 * A reason written before records — a line of the reason file in a past commit, or a 0.7 reason — read as a record
 * with only its context. It has no title of its own, so its first sentence stands in, cut at a length a list line can carry.
 */
export function reasonRecord(id: string, docs: string[], reason: string): AttachedRecord {
  const text = reason.trim();
  const first = /^[\s\S]*?(?:[.!?。](?=\s|$)|\n)/.exec(text)?.[0].trim() || text;
  const title = [...first].length > 80 ? [...first].slice(0, 79).join('').trimEnd() + '…' : first;
  return { id, title, docs, sections: [{ key: 'context', body: text }] };
}

/** The records that explain one document, without the list of documents each explains. */
export const recordsFor = (records: AttachedRecord[], id: string): EventRecord[] =>
  records.filter(r => r.docs.includes(id)).map(({ docs: _docs, ...record }) => record);
