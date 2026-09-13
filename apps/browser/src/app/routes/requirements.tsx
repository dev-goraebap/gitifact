import { createFileRoute } from '@tanstack/react-router';
import { WorkspacePage, validateWorkspaceSearch } from '../../pages/workspace';
export const Route = createFileRoute('/requirements')({
  validateSearch: validateWorkspaceSearch,
  component: WorkspaceRoute,
});
function WorkspaceRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WorkspacePage
      view="requirements"
      search={search}
      onSearch={(next, replace) => {
        void navigate({ search: next, replace: replace ?? false });
      }}
    />
  );
}
