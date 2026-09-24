import { createFileRoute, redirect } from '@tanstack/react-router';
// The browser opens on the dashboard.
export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/dashboard', replace: true }); },
});
