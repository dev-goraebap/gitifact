// Records: why documents changed and which option was chosen, one Markdown file each. A record is written once and
// never edited; when a decision changes, a new record says so, and a document's records in order tell its story.

/** The sections a record body may hold, by a key that does not depend on the language the heading is written in. */
export const recordSectionKeys = ['context', 'decision', 'alternatives'] as const;
export type RecordSectionKey = typeof recordSectionKeys[number];

/**
 * Every record has the same shape: the context that called for a decision and the decision, in that order, and the
 * alternatives only when some were really considered — a requirement change often has none.
 */
export const RECORD_REQUIRED_SECTIONS: readonly RecordSectionKey[] = ['context', 'decision'];

/** Headings are written in the project's language; both names read as the same section. */
export const RECORD_SECTION_HEADINGS: Record<RecordSectionKey, { ko: string; en: string }> = {
  context: { ko: '맥락', en: 'Context' },
  decision: { ko: '결정', en: 'Decision' },
  alternatives: { ko: '검토한 대안', en: 'Alternatives considered' },
};

/** A title is a short noun phrase that names the decision, read on one line of a list. Counted in characters. */
export const RECORD_TITLE_LIMIT = 80;
/** A section keeps to a few sentences: longer text belongs in the document it explains. Counted in characters. */
export const RECORD_SECTION_LIMIT = 500;

export interface RecordSection { key: RecordSectionKey; heading: string; body: string }
/**
 * One record file. `docs` are the documents it explains, including ones it deletes. Author and time are not in the
 * file; they come from the commit that added it.
 */
export interface DecisionRecord { id: string; path: string; title: string; docs: string[]; sections: RecordSection[]; draft?: true }
