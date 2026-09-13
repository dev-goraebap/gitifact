export type WorkspaceSearch = {
  q?: string | undefined;
  spec?: string | undefined;
  state?: 'draft' | 'active' | 'approved' | undefined;
  selected?: string | undefined;
};
export function validateWorkspaceSearch(value: Record<string, unknown>): WorkspaceSearch {
  return {
    q: typeof value.q === 'string' ? value.q.slice(0, 300) : undefined,
    spec: typeof value.spec === 'string' ? value.spec.slice(0, 100) : undefined,
    state:
      value.state === 'draft' || value.state === 'active' || value.state === 'approved'
        ? value.state
        : undefined,
    selected: typeof value.selected === 'string' ? value.selected.slice(0, 200) : undefined,
  };
}
