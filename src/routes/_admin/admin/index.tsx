import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/admin/')({
  // The _admin layout's beforeLoad has already verified session and role by
  // the time this child runs, so the redirect is unconditional.
  beforeLoad: () => {
    throw redirect({ to: '/admin/dashboard' });
  },
});
