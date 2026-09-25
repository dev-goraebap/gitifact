/** What a commit page shows: one of its three parts and, in the code part, the file being read. */
export type CommitTab = 'records' | 'documents' | 'code';
export interface CommitSearch { tab?: CommitTab; file?: string }
