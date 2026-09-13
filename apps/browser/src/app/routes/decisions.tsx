import { createFileRoute } from '@tanstack/react-router';
import { WorkspacePage, validateWorkspaceSearch } from '../../pages/workspace';
export const Route = createFileRoute('/decisions')({
  validateSearch: validateWorkspaceSearch,
  component: WorkspaceRoute,
});
function WorkspaceRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WorkspacePage
      view="decisions"
      search={search}
      onSearch={(next, replace) => {
        void navigate({ search: next, replace: replace ?? false });
      }}
    />
  );
}
