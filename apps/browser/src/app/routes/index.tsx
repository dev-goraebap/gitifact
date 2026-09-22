import { createFileRoute, redirect } from '@tanstack/react-router';
// The browser opens on the product overview.
export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/product', replace: true }); },
});
