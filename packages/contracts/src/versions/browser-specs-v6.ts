import { z } from 'zod';

// The browser's records in the 0.8.0 document model: every document is one file with its own ID, and a feature holds
// its requirements and design documents in `order`. Project instructions joined as a document kind in specs v6 and
// search v2, and records replaced reasons in history v5, summary v4 and commit v3; the versions before them had no
// consumers outside the CLI and were removed.

const contributor = z.strictObject({ email: z.string(), name: z.string(), commits: z.number().int().nonnegative(), latest: z.string() });
// A document the design drew on: another document by ID (its title and path resolved when it exists) or an outside page.
const source = z.strictObject({ id: z.string().optional(), title: z.string().optional(), path: z.string().optional(), url: z.string().optional(), note: z.string().optional() });
const requirement = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), order: z.number().int().nonnegative(), body: z.string() });
const design = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), order: z.number().int().nonnegative(), body: z.string(),
  requirements: z.array(z.string()), sources: z.array(source) });
const feature = z.strictObject({ id: z.string(), path: z.string(), title: z.string(), description: z.string(), body: z.string(),
  requirements: z.array(requirement), designs: z.array(design),
  // Authors of commits touching the feature folder and the latest such commit; empty until first committed.
  contributors: z.array(contributor), updatedAt: z.string().nullable() });
// A project instruction: its index.md and the other files of its folder, which the browser reads one at a time.
// `title` is a Markdown file's first `# ` heading, which the browser shows instead of the file name; other files have none.
const instructionFile = z.strictObject({ path: z.string(), size: z.number().int().nonnegative(), title: z.string().optional() });
const instruction = z.strictObject({ id: z.string(), name: z.string(), path: z.string(), title: z.string(), description: z.string(), body: z.string(),
  // Paths relative to the instruction folder, index.md left out; `limited` when the folder holds more than the list carries.
  files: z.array(instructionFile), filesLimited: z.boolean(), updatedAt: z.string().nullable() });
// AGENTS.md at the repository root: the instructions every session loads, which point at the ones above.
const agents = z.strictObject({ path: z.string(), body: z.string(), updatedAt: z.string().nullable() });
// A file the cache could not read: the browser says so instead of silently leaving the document out.
const problem = z.strictObject({ code: z.string(), path: z.string(), message: z.string() });
const oid = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

/** The checkout: the current features, instructions and AGENTS.md, the contributors, and whether anything is uncommitted. */
export const browserSpecsV6 = z.strictObject({
  contract: z.literal('browser-specs'), version: z.literal(6), sessionId: z.string(),
  head: oid.nullable(), observedAt: z.string(), working: z.boolean(),
  features: z.array(feature), instructions: z.array(instruction), agents: agents.nullable(), problems: z.array(problem),
  contributors: z.array(contributor), contributorsLimited: z.boolean(),
});

const kind = z.enum(['feature', 'requirement', 'design', 'wiki', 'instruction']);
// What a list row needs to name a document: no body. The body comes with the change when the entry is opened.
const reference = z.strictObject({ id: z.string(), title: z.string(), specId: z.string(), path: z.string() }).nullable();
// The full document at one side of a change, as the detail shows it.
const snapshot = z.strictObject({ id: z.string(), kind, title: z.string(), description: z.string(), body: z.string(), specId: z.string(), path: z.string(),
  order: z.number().int().optional(), requirements: z.array(z.string()).optional(), sources: z.array(source).optional() }).nullable();
const changeType = z.enum(['created', 'modified', 'moved', 'deleted']);
// A record that explains the change: its title and sections, keyed so the reader names them in its own language.
// Reasons from before records arrive as records with only a context, titled by their first sentence.
const recordSection = z.strictObject({ key: z.enum(['context', 'decision', 'alternatives']), body: z.string() });
const record = z.strictObject({ id: z.string(), title: z.string(), sections: z.array(recordSection) });
const event = z.strictObject({ key: z.string(), commit: oid, date: z.string(), author: z.string(), email: z.string(),
  committer: z.string(), message: z.string(), id: z.string(), kind, types: z.array(changeType),
  before: reference, after: reference, records: z.array(record) });

/** Changes matching the query over the whole history of `head`, newest first, one page of them. */
export const browserHistoryV5 = z.strictObject({
  contract: z.literal('browser-history'), version: z.literal(5), sessionId: z.string(), head: oid,
  // Matching changes in all of history, not in this page; `offset` is where this page starts among them.
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), events: z.array(event),
});
/** What the product overview draws from history: counts over all of it and its newest commits. */
export const browserHistorySummaryV4 = z.strictObject({
  contract: z.literal('browser-history-summary'), version: z.literal(4), sessionId: z.string(), head: oid,
  total: z.number().int().nonnegative(), byType: z.strictObject({ created: z.number().int().nonnegative(), modified: z.number().int().nonnegative(), moved: z.number().int().nonnegative(), deleted: z.number().int().nonnegative() }),
  // One entry per commit within three weeks of the newest change, so the reader can count by its own calendar day.
  pulse: z.array(z.strictObject({ date: z.string(), count: z.number().int().positive() })),
  // The newest commits: a few of their changes each and how many there are in all.
  recent: z.array(z.strictObject({ commit: oid, count: z.number().int().positive(), events: z.array(event) })),
});
/** Documents whose title, place or text holds the query: the current features and instructions, then past changes. */
export const browserSearchV2 = z.strictObject({
  contract: z.literal('browser-search'), version: z.literal(2), sessionId: z.string(), query: z.string(),
  hits: z.array(z.strictObject({
    id: z.string(), kind: z.enum(['feature', 'requirement', 'design', 'instruction', 'history']),
    title: z.string(), where: z.string(), line: z.string(),
    // What the hit opens: a feature (with the requirement or design tab), an instruction, or one change in the activity.
    featureId: z.string().optional(), documentId: z.string().optional(), key: z.string().optional(),
  })),
});
export type BrowserSpecsV6 = z.infer<typeof browserSpecsV6>;
export type BrowserHistoryV5 = z.infer<typeof browserHistoryV5>;
export type BrowserHistorySummaryV4 = z.infer<typeof browserHistorySummaryV4>;
export type BrowserSearchV2 = z.infer<typeof browserSearchV2>;
export type SpecEvent = z.infer<typeof event>;
export type SpecRecord = z.infer<typeof record>;
export type SpecSnapshot = NonNullable<z.infer<typeof snapshot>>;
export type SpecFeature = z.infer<typeof feature>;
export type SpecRequirement = z.infer<typeof requirement>;
export type SpecDesign = z.infer<typeof design>;
export type SpecInstruction = z.infer<typeof instruction>;
export type InstructionFile = z.infer<typeof instructionFile>;
export type AgentsFile = z.infer<typeof agents>;
export type DesignSource = z.infer<typeof source>;

// Query strings the browser API accepts. Every value arrives as text; a key given twice is refused before these run.
const headQuery = oid;
const count = (max: number) => z.string().regex(/^(0|[1-9]\d{0,6})$/).transform(Number).pipe(z.number().int().min(0).max(max));
/** `/api/v1/history`: which HEAD, which page, and the filters, all optional but the HEAD. */
export const browserHistoryQueryV3 = z.strictObject({
  head: headQuery, offset: count(1_000_000).optional(), limit: count(100).pipe(z.number().min(1)).optional(),
  kind: changeType.optional(), document: kind.optional(),
  feature: z.string().regex(/^S-[a-z2-7]{10}$/).optional(), author: z.string().min(1).max(320).optional(), q: z.string().max(200).optional(),
});
export const browserHistorySummaryQueryV1 = z.strictObject({ head: headQuery });
/** `/api/v1/search`: the words, and the HEAD whose history to look through (none before the first commit). */
export const browserSearchQueryV1 = z.strictObject({ q: z.string().min(1).max(200), head: headQuery.optional() });
/** `/api/v1/instructions/file`: one file of an instruction folder, by the instruction's ID and the path inside the folder. */
export const browserInstructionFileQueryV1 = z.strictObject({ id: z.string().regex(/^I-[a-z2-7]{10}$/), path: z.string().min(1).max(1000) });
export const changelogQueryV1 = z.strictObject({ lang: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional() });

// The source files a commit changed beside its documents, for the activity detail. Paths under `.gitifact` are left
// out: their changes are the records above.
const fileStatus = z.enum(['added', 'modified', 'deleted', 'renamed']);
const commitFile = z.strictObject({ path: z.string(), previousPath: z.string().optional(), status: fileStatus,
  // Line counts against the first parent; null for a binary file, which has no lines.
  additions: z.number().int().nonnegative().nullable(), deletions: z.number().int().nonnegative().nullable() });
/** Every source file one commit changed against its first parent, capped at `limit` with the whole count beside. */
export const browserCommitFilesV1 = z.strictObject({
  contract: z.literal('browser-commit-files'), version: z.literal(1), sessionId: z.string(), commit: oid,
  total: z.number().int().nonnegative(), files: z.array(commitFile),
});
/** One file of a commit on both sides, as text; a side is null where the file did not exist. */
export const browserCommitFileV1 = z.strictObject({
  contract: z.literal('browser-commit-file'), version: z.literal(1), sessionId: z.string(), commit: oid, file: commitFile,
  // `binary` and `tooLarge` leave both texts null: the reader is told why instead of shown noise.
  before: z.string().nullable(), after: z.string().nullable(), binary: z.boolean(), tooLarge: z.boolean(),
});
export const browserCommitFilesQueryV1 = z.strictObject({ commit: oid });
export const browserCommitFileQueryV1 = z.strictObject({ commit: oid, path: z.string().min(1).max(4096) });
export type BrowserCommitFilesV1 = z.infer<typeof browserCommitFilesV1>;
export type BrowserCommitFileV1 = z.infer<typeof browserCommitFileV1>;
export type CommitFile = z.infer<typeof commitFile>;

/** One commit as its page reads it: who made it, why, and every document it changed with both sides. */
export const browserCommitV3 = z.strictObject({
  contract: z.literal('browser-commit'), version: z.literal(3), sessionId: z.string(), commit: oid,
  author: z.string(), email: z.string(), committer: z.string(), date: z.string(), message: z.string(),
  changes: z.array(z.strictObject({ event, before: snapshot, after: snapshot })),
});
export const browserCommitQueryV1 = z.strictObject({ commit: oid });
export type BrowserCommitV3 = z.infer<typeof browserCommitV3>;

// A decision record is `DR-`; a reason from before decision records (a reason line, a 0.7 reason) keeps its `H-` ID.
const recordId = z.string().regex(/^(?:DR|H)-[A-Za-z0-9_-]{1,64}$/);
/** Which commit of `head`'s history added a record: the record page reads that commit and shows the record's part. */
export const browserRecordV1 = z.strictObject({
  contract: z.literal('browser-record'), version: z.literal(1), sessionId: z.string(), head: oid, id: recordId, commit: oid,
});
export const browserRecordQueryV1 = z.strictObject({ head: oid, id: recordId });
export type BrowserRecordV1 = z.infer<typeof browserRecordV1>;

/** One file of an instruction folder from the working tree: its text, or why there is none (binary, over 512 KB). */
export const browserInstructionFileV1 = z.strictObject({
  contract: z.literal('browser-instruction-file'), version: z.literal(1), sessionId: z.string(), id: z.string(), path: z.string(),
  text: z.string().nullable(), size: z.number().int().nonnegative(), binary: z.boolean(), tooLarge: z.boolean(),
});
export type BrowserInstructionFileV1 = z.infer<typeof browserInstructionFileV1>;
