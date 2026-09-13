export type ObjectFormat = 'sha1' | 'sha256';
export type RepositoryHead =
  | { state: 'branch'; branch: string; commit: string }
  | { state: 'detached'; branch: null; commit: string }
  | { state: 'unborn'; branch: string; commit: null };

export interface SubmoduleChanges {
  commitChanged: boolean;
  trackedChanges: boolean;
  untrackedChanges: boolean;
}
export type RepositoryChange =
  | { kind: 'tracked' | 'unmerged'; path: string; xy: string; submodule: SubmoduleChanges | null }
  | { kind: 'untracked'; path: string; xy: null; submodule: null };

export interface RepositoryState {
  repository: { key: string; worktreeKey: string; rootPath: string; objectFormat: ObjectFormat };
  head: RepositoryHead;
  changes: RepositoryChange[];
}
export interface ChangeSummary {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
}
export function summarizeChanges(changes: readonly RepositoryChange[]): ChangeSummary {
  const result = { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
  for (const change of changes) {
    if (change.kind === 'untracked') result.untracked++;
    else if (change.kind === 'unmerged') result.conflicted++;
    else {
      if (change.xy[0] !== '.') result.staged++;
      if (change.xy[1] !== '.') result.unstaged++;
    }
  }
  return result;
}
