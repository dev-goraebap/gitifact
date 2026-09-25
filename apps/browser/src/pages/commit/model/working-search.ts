/** What the uncommitted page shows: the records written for the next commit, or the documents changed since HEAD. */
export type WorkingTab = 'records' | 'documents';
export interface WorkingSearch { tab?: WorkingTab }
