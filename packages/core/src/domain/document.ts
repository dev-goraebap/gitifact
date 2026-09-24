import { t } from '../shared/i18n/index.js';

// The 0.8.0 document model. Every structural fact lives in frontmatter; the body is prose that is never parsed for data.
// Membership comes from the folder a file sits in, identity from its `id`, order from `order`.

export type DocKind = 'feature' | 'requirement' | 'design' | 'wiki' | 'instruction';

/** ID prefix per kind. `H-` names a reason line in history.jsonl. IDs are issued by the CLI and never change. */
export const DOC_ID_PREFIX = { feature: 'S', requirement: 'R', design: 'D', wiki: 'W', instruction: 'I' } as const satisfies Record<DocKind, string>;
export const REASON_ID_PREFIX = 'H';
const token = '[a-z2-7]{10}';
export const docIdPattern = new RegExp(`^[SRDWI]-${token}$`);
export const reasonIdPattern = new RegExp(`^H-${token}$`);
export const idPatternOf = (kind: DocKind) => new RegExp(`^${DOC_ID_PREFIX[kind]}-${token}$`);
export const kindOfId = (id: string): DocKind | undefined =>
  (Object.entries(DOC_ID_PREFIX) as [DocKind, string][]).find(([, prefix]) => id.startsWith(prefix + '-'))?.[0];

/** A document the design refers to: another Gitifact document by ID, or an outside page by title and URL. */
export type DocSource = { id: string; note?: string } | { title: string; url: string; note?: string };

// `draft: true` marks a file `docs new` made and the author has not finished; the check fails until the line is removed.
interface DocBase { id: string; path: string; title: string; description: string; body: string; draft?: true }
export interface FeatureDoc extends DocBase { kind: 'feature'; feature: string }
export interface RequirementDoc extends DocBase { kind: 'requirement'; feature: string; order: number }
export interface DesignDoc extends DocBase { kind: 'design'; feature: string; order: number; requirements: string[]; sources: DocSource[] }
/** A wiki page of a commit before 0.8.0, read for the history only; instructions replaced the wiki. */
export interface WikiDoc extends DocBase { kind: 'wiki' }
/**
 * A project instruction: `.gitifact/instructions/<name>/index.md`, what agents read for one kind of work when AGENTS.md
 * sends them there. `name` is the folder; the other files of the folder (references) belong to it.
 */
export interface InstructionDoc extends DocBase { kind: 'instruction'; name: string }
export type Doc = FeatureDoc | RequirementDoc | DesignDoc | WikiDoc | InstructionDoc;

/** One line of history.jsonl: why the listed documents changed. Author and time are read from the commit. */
export interface DocReason { id: string; docs: string[]; reason: string }

export const docProblemCodes = [
  // One file
  'PATH_UNSUPPORTED', 'FRONTMATTER_REQUIRED', 'FRONTMATTER_UNCLOSED', 'FRONTMATTER_LINE', 'FRONTMATTER_VALUE',
  'FRONTMATTER_UNKNOWN_KEY', 'FRONTMATTER_MISSING_KEY', 'ID_FORMAT', 'SOURCE_INVALID', 'BODY_REQUIRED', 'BODY_HEADING',
  'BODY_MARKER', 'BODY_UNCLOSED_FENCE', 'INVALID_CHARACTERS', 'FILE_TOO_LARGE', 'REASON_INVALID',
  'INSTRUCTION_INDEX_REQUIRED', 'INSTRUCTION_SPEC_LINK', 'WIKI_REMOVED',
  // Across files
  'DOC_DRAFT', 'DUPLICATE_ID', 'DUPLICATE_REASON_ID', 'DUPLICATE_ORDER', 'MISSING_REFERENCE', 'FEATURE_INDEX_REQUIRED', 'DESIGN_OVERVIEW_REQUIRED',
] as const;
export type DocProblemCode = typeof docProblemCodes[number];
export interface DocProblem { code: DocProblemCode; path: string; message: string }

/** Findings the checks report without blocking a commit: broken relative links and assets outside the recommendations. */
export const docWarningCodes = ['MISSING_LINK_TARGET', 'ASSET_SIZE', 'ASSET_EXTENSION', 'UNREFERENCED_ASSET', 'ASSETS_TOTAL_SIZE'] as const;
export type DocWarningCode = typeof docWarningCodes[number];
export interface DocWarning { code: DocWarningCode; path: string; message: string }
export const docWarning = (code: DocWarningCode, path: string, values: Record<string, unknown> = {}): DocWarning => ({ code, path, message: t(`warn.${code}`, { path, ...values }) });

/** A problem with its message in the current language. */
export const docProblem = (code: DocProblemCode, path: string, values: Record<string, unknown> = {}): DocProblem => ({ code, path, message: t(`doc.${code}`, { path, ...values }) });

export class DocumentError extends Error {
  constructor(readonly code: DocProblemCode, readonly path: string, message: string) { super(message); this.name = 'DocumentError'; }
}
