import { createFileRoute, redirect } from '@tanstack/react-router';
import { validateProductSearch } from '../../pages/product';
// The browser opens on the product overview. Activity lived at / until 0.5.0, so a link that still carries its
// filters or selection (/?selected=…) goes on to /activity.
export const Route = createFileRoute('/')({
  validateSearch: validateProductSearch,
  beforeLoad: ({ search }) => {
    throw Object.keys(search).length > 0 ? redirect({ to: '/activity', search, replace: true }) : redirect({ to: '/product', replace: true });
  },
});
